## Why

RealtyTrack se publicará en Internet (Vercel + Neon + Cloudflare R2 privado) como MVP de demostración para los evaluadores del máster. La auditoría de seguridad previa al despliegue (hallazgos S-01…S-15) y la revisión de dependencias de Prisma concluyeron que el código de negocio es sólido (autorización anidada, transacciones, R2 privado), pero que faltan controles de endurecimiento que dejan de ser opcionales al exponer el login y el almacenamiento públicamente: no hay límite de intentos de login, la sesión dura 30 días, no hay cabeceras de seguridad ni comprobación de origen en la API, y la URL firmada de subida a R2 puede reutilizarse para sobrescribir un documento ya registrado, sin cuotas de almacenamiento.

## What Changes

- **Login con límite de intentos persistente en PostgreSQL** (compatible con serverless): 5 intentos por cuenta y 20 por IP en ventana de 15 minutos, contadores atómicos, expiración automática y limpieza acotada. IP tomada de la cabecera que Vercel sobrescribe, nunca de cabeceras manipulables.
- **Mitigación de enumeración de usuarios**: verificación Argon2id contra un hash válido cuando el email no existe; mensajes de error genéricos.
- **Sesión de 8 horas con expiración absoluta** (no renovable más allá del inicio de sesión).
- **Autenticación en layouts privados** (defensa en profundidad) y **matcher del proxy sin exclusiones por prefijo**.
- **Cabeceras HTTP de seguridad** (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS, CSP compatible con Next.js/R2) y `poweredByHeader: false`.
- **Protección CSRF por verificación de `Origin`** contra una lista de orígenes confiables en las mutaciones de `/api/*` (excepto `/api/auth/*`) y **límite de tamaño de cuerpo** de la API; **límites de longitud** (`.max()`) en los textos libres de los esquemas Zod, sin truncar listados.
- **Subida de documentos en dos fases con promoción**: el navegador sube a una clave temporal (`tmp/…`); el backend valida el objeto fijando su ETag y lo promueve con una copia condicional a una clave definitiva distinta, sobre la que el navegador nunca recibe permiso de escritura. Reserva de subida de un solo uso (token firmado con secreto independiente `DOCUMENT_UPLOAD_SECRET`), registro idempotente, manejo de fallos parciales PostgreSQL/R2.
- **Cuotas de documentos** para la demo: 20 MB por documento, 50 por propiedad, 200 MB por propiedad, 1 GB global, contando reservas pendientes y liberando las vencidas, sin bypass concurrente.
- **Limpieza de temporales**: borrado oportunista de reservas vencidas y regla Lifecycle de R2 a 24 h sobre `tmp/` (configuración manual documentada).
- **Build**: el script pasa a `prisma generate && next build`.
- **Documentación**: protecciones, variables nuevas, migraciones pendientes de aplicar, configuración manual de R2, riesgos residuales de dependencias (con salida completa de `npm audit` y evidencia de alcanzabilidad) y limitaciones del MVP.
- Dos migraciones aditivas (`login_intento`, `documento_subida`); no tocan datos existentes. Los documentos ya registrados conservan su clave `propiedades/{propiedadId}/{uuid}` y siguen funcionando sin cambios.

Fuera de alcance: Redis, MFA, roles, multiusuario, antivirus, CSP con nonces, revocación global de sesiones, actualización de ESLint u otras dependencias, overrides, cambio de versión de Prisma/Next/Zod, y cualquier regla financiera (UF, créditos, contratos, abonos, movimientos).

## Capabilities

### New Capabilities
- `http-security`: cabeceras de seguridad, verificación de origen (CSRF) y límite de tamaño de solicitud en la API propia, y límites de longitud en la entrada.

### Modified Capabilities
- `single-user-auth`: límite de intentos persistente por cuenta e IP, mitigación de enumeración, duración de sesión de 8 horas absoluta, comprobación de sesión en layouts privados y matcher del proxy exacto.
- `document-management`: subida en dos fases con clave temporal y promoción condicional, reserva de un solo uso con secreto independiente, cuotas con reservas, limpieza de temporales y fallos parciales.
- `project-foundation`: script de build con `prisma generate`, variables de entorno nuevas documentadas y registro del riesgo residual de dependencias.

## Impact

- **Código**: `auth.ts`, `auth.config.ts`, `proxy.ts`, `next.config.ts`, `app/dashboard/layout.tsx`, `app/propiedades/layout.tsx`, `server/auth/*` (nuevo `login-limiter.ts`, ajuste de `verify-credentials.ts`), `server/storage/*` (puerto con copia condicional y ETag), `server/services/documento-service.ts` y `index.ts`, `server/domain/documento.ts`, `server/schemas/*` (`.max()`), `package.json` (solo el script `build`).
- **Base de datos**: `prisma/schema.prisma` + 2 migraciones nuevas (`login_intento`, `documento_subida`). No se aplican contra ninguna base en este change.
- **API**: los contratos de `/documentos/subida` y `/documentos` conservan los campos actuales (`storageKey`, `tokenSubida`); `storageKey` pasa a ser la clave temporal. Nuevos códigos: 403 (origen no confiable), 413 (cuerpo demasiado grande), 429 (límite de intentos), 422 por cuota.
- **Frontend**: sin cambios de apariencia; solo se muestran los mensajes de error de seguridad y cuota.
- **Entorno/infra**: variables nuevas `DOCUMENT_UPLOAD_SECRET` y `APP_ORIGINS`; regla Lifecycle manual en R2; CORS del bucket para el origen de la app.
- **Dependencias**: ninguna nueva ni actualizada; se mantienen Next 16.4.6, Zod 4.6.7 y Prisma 6.19.3.
