# http-security Specification

## Purpose
TBD - created by archiving change seguridad-mvp. Update Purpose after archive.
## Requirements
### Requirement: Cabeceras HTTP de seguridad
El sistema SHALL responder todas las páginas y rutas con las cabeceras `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, una `Permissions-Policy` que deshabilite cámara, micrófono y geolocalización, `Strict-Transport-Security` y una `Content-Security-Policy`, y SHALL NOT emitir la cabecera `X-Powered-By`.

#### Scenario: Cabeceras presentes
- **WHEN** se solicita cualquier página o ruta de la aplicación
- **THEN** la respuesta incluye las cabeceras de seguridad indicadas y no incluye `X-Powered-By`

### Requirement: Política CSP compatible con la aplicación y el almacenamiento
La `Content-Security-Policy` SHALL restringir `default-src`, `object-src`, `base-uri`, `form-action` y `frame-ancestors` a valores propios o `none`, SHALL permitir en `connect-src` únicamente el origen propio y el host del almacenamiento S3-compatible configurado, y SHALL NOT permitir `unsafe-eval` en producción. La política SHALL ser compatible con la hidratación de Next.js, los gráficos y la subida directa de documentos al almacenamiento.

#### Scenario: Orígenes limitados a lo necesario
- **WHEN** se inspecciona la política emitida
- **THEN** no contiene comodines ni orígenes externos distintos del host del almacenamiento configurado, y `img-src` y `font-src` no incluyen orígenes que la aplicación no use

#### Scenario: Subida directa permitida
- **WHEN** el navegador sube un documento con la URL firmada al host del almacenamiento configurado
- **THEN** la política no bloquea la solicitud

#### Scenario: Otros destinos bloqueados
- **WHEN** una página intenta conectarse con `fetch` a un host distinto del propio y del almacenamiento
- **THEN** la política lo bloquea

#### Scenario: Sin evaluación dinámica en producción
- **WHEN** se inspecciona la política emitida en producción
- **THEN** `script-src` no contiene `unsafe-eval`

#### Scenario: Riesgo residual de unsafe-inline documentado
- **WHEN** se consulta la documentación de seguridad
- **THEN** declara que `script-src` mantiene `'unsafe-inline'` por la hidratación de Next.js con Cache Components, qué protección de XSS se pierde y qué mitigaciones lo compensan

### Requirement: Verificación de origen en toda mutación
El sistema SHALL rechazar con 403 JSON toda solicitud `POST`, `PUT`, `PATCH` o `DELETE` a cualquier ruta interceptada por el proxy (las rutas de `/api/*` salvo `/api/auth/*` y cualquier página, lo que cubre también posibles Server Actions) cuyo `Origin` no pertenezca a la lista de orígenes confiables configurada en el servidor (`APP_ORIGINS`). Si la solicitud no trae `Origin`, SHALL aceptarla solo cuando `Sec-Fetch-Site` sea `same-origin`. La comprobación SHALL ejecutarse antes de la comprobación de sesión y SHALL NOT alterar los mecanismos CSRF propios de Auth.js. Las solicitudes `GET` y `HEAD` no se ven afectadas.

#### Scenario: Origen confiable
- **WHEN** una mutación llega con un `Origin` incluido en `APP_ORIGINS` y sesión válida
- **THEN** la solicitud continúa su procesamiento normal

#### Scenario: Origen ajeno
- **WHEN** una mutación llega con `Origin: https://evil.example`
- **THEN** responde 403 y no ejecuta ninguna lógica de negocio

#### Scenario: Sin Origin ni señal same-origin
- **WHEN** una mutación llega sin `Origin` y sin `Sec-Fetch-Site: same-origin`
- **THEN** responde 403

#### Scenario: Auth.js intacto
- **WHEN** se envía el formulario de acceso a `/api/auth/*`
- **THEN** la verificación de origen del sistema no interviene y Auth.js aplica sus propias comprobaciones

#### Scenario: Mutación dirigida a una página
- **WHEN** una solicitud `POST` a una página privada llega con `Origin` ajeno
- **THEN** responde 403 antes de cualquier otra comprobación

#### Scenario: Cobertura de todos los handlers
- **WHEN** se enumeran los Route Handlers de `app/api` y sus métodos exportados
- **THEN** todo método que no sea `GET` queda bajo la verificación de origen, y ningún handler `GET` modifica datos

#### Scenario: Orígenes no configurados en producción
- **WHEN** la aplicación corre en producción sin `APP_ORIGINS`
- **THEN** toda mutación a `/api/*` se rechaza con 403 (cierre por defecto)

### Requirement: Límite de tamaño de solicitud
El sistema SHALL rechazar con 413 JSON las solicitudes a `/api/*` que declaren un `Content-Length` superior a 1 MiB. Las rutas de documentos no transportan el binario, por lo que el límite aplica también a ellas.

#### Scenario: Cuerpo excesivo
- **WHEN** una solicitud a `/api/*` declara más de 1 MiB de cuerpo
- **THEN** responde 413 sin leer el cuerpo

#### Scenario: Cuerpo normal
- **WHEN** una solicitud declara un cuerpo de pocos KB
- **THEN** continúa su procesamiento normal

### Requirement: Límites de longitud en la entrada
Los esquemas de validación SHALL acotar con un máximo explícito todos los textos libres (nombres, notas, descripciones, nombre de archivo) sin truncar silenciosamente: una entrada que excede el máximo SHALL rechazarse con 400. Los listados SHALL conservar su contrato actual y SHALL NOT truncarse.

#### Scenario: Texto demasiado largo
- **WHEN** se envía un campo de texto libre con más caracteres que su máximo
- **THEN** responde 400 indicando el campo y el límite

#### Scenario: Texto dentro del límite
- **WHEN** se envía un campo de texto libre con una longitud válida
- **THEN** se acepta y se guarda sin modificarlo

#### Scenario: Listados sin truncar
- **WHEN** se consulta un listado existente
- **THEN** devuelve todos los elementos como antes

