## Context

La auditoría previa (S-01…S-15) y la revisión de dependencias de Prisma son la base de este change y no se repiten aquí. Estado observado relevante:

- `auth.ts` llama directamente a `verifyCredentials` sin contador; `verify-credentials.ts` retorna `null` antes de ejecutar Argon2 si el email no existe; no hay `maxAge` (30 días por defecto de Auth.js).
- `proxy.ts` usa el matcher `/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)` (exclusión por prefijo); `auth.config.ts` implementa `authorized` y no tiene callback `jwt`.
- Los 24 Route Handlers llaman a `requireSession()`; los layouts privados no verifican sesión. `next.config.ts` tiene `cacheComponents: true` y ninguna cabecera.
- `documento-service.ts` firma el token con `S3_SECRET_ACCESS_KEY`; la URL PUT firmada apunta directamente a la clave definitiva `propiedades/{id}/{uuid}`, de modo que mientras vive (5 min) puede reescribir el objeto ya registrado. No hay cuotas.
- El almacén (`s3-almacen.ts`, `s3-sigv4.ts`) solo usa SigV4 por query string con `HEAD`, `GET`, `PUT`, `DELETE`; admite cabeceras firmadas adicionales mediante `cabeceras`.
- Las mutaciones financieras serializan por propiedad con `pg_advisory_xact_lock(hashtext(...))`: ese patrón ya existe y se reutiliza.
- Despliegue: Vercel serverless (sin memoria compartida entre instancias), Neon, R2 privado. Datos ficticios, usuario único.

## Goals / Non-Goals

**Goals:**
- Cerrar los hallazgos bloqueantes de la auditoría (S-01, S-03, S-07, S-09) y los de bajo costo asociados (S-04, S-05, S-06, S-08, S-10, S-11, S-13) sin tocar reglas de negocio.
- Que ningún control dependa de memoria de proceso.
- Que el objeto promovido sea exactamente el validado, sin ventana de carrera.
- Compatibilidad total con documentos ya registrados y con el frontend actual (mismos campos de API).

**Non-Goals:**
- Redis, MFA, roles, multiusuario, revocación global de sesiones (`tokenVersion`), antivirus, CSP con nonces, rate limiting general de la API, tareas programadas.
- Cambiar versiones de dependencias, overrides, actualizar ESLint.
- Aplicar migraciones o modificar R2/Vercel/Neon: solo se entregan migraciones, código y documentación de pasos manuales.

## Decisions

### D1. Rate limiting: reservar el intento antes de verificar, en una tabla de PostgreSQL
Tabla `login_intento(clave PK, contador, ventana_inicio, actualizado_en)`. Una sola sentencia atómica (`INSERT … ON CONFLICT (clave) DO UPDATE SET contador = CASE WHEN ventana_inicio < now() - 15 min THEN 1 ELSE contador + 1 END, ventana_inicio = CASE … END RETURNING contador`) incrementa y devuelve el valor. Si `contador > límite` de IP, se deniega **sin** ejecutar Argon2; si se supera el de la cuenta, se deniega sin verificar jamás contra el hash de la cuenta, pero se ejecuta Argon2id contra el hash de relleno (paridad de coste: si no, agotar el cubo genérico de emails inexistentes y medir tiempos revelaría qué emails existen; el coste queda acotado por el límite por IP de 20). Se cuenta cada intento (no solo los fallidos) y un acceso correcto borra la fila de la cuenta; así 50 solicitudes concurrentes reciben contadores distintos y solo 5 pasan a verificar. Ventana fija: el bloqueo expira solo cuando la ventana vence.
- Claves: `cuenta:<sha256(id de usuario)>` y `ip:<sha256(ip)>`. Para un email inexistente la clave de cuenta es la constante `cuenta:desconocida` (cuenta genérica compartida), por lo que los emails arbitrarios no crean filas ni se almacenan; el abuso queda acotado por IP. Compromiso: un atacante puede agotar el cubo genérico, lo que solo afecta a quien escriba un email erróneo; un bloqueo de la cuenta real por un tercero (DoS de login) es inherente al bloqueo por cuenta y se acepta en una demo de usuario único (el bloqueo dura 15 min).
- Umbrales: 5 por cuenta (pedido) y **20 por IP**: tolera NAT/uso compartido razonable de evaluadores y corta la fuerza bruta (20 × 4 ciclos/hora ≈ 80 intentos/h/IP). Constantes en un único módulo.
- Limpieza acotada: en cada intento (también los denegados), `DELETE … WHERE clave IN (SELECT clave … WHERE ventana_inicio < now() - 1 day LIMIT 50)`.
- Fallo de PostgreSQL: **cierre por defecto**. Si la reserva del intento lanza un error, el acceso se deniega con el mismo error genérico, no se verifica la contraseña y se registra el fallo sin email ni IP. No hay degradación a «sin límite»; el login ya depende de la misma base para validar credenciales, así que no se pierde disponibilidad adicional.
- Normalización: el email se recorta y pasa a minúsculas (máximo 254 caracteres; más largo se deniega sin consultar) antes de buscar al usuario, con búsqueda insensible a mayúsculas para no invalidar un usuario sembrado con otra capitalización.
- Alternativas descartadas: contador en memoria (inválido en serverless), Redis/Upstash (infraestructura nueva no pedida), contar solo fallos tras verificar (permite bypass concurrente: todas las solicitudes verifican antes de que se registre el primer fallo).
- Al denegar por límite se responde con el mismo error genérico de Auth.js (`CredentialsSignin`) para no filtrar el estado; la causa se registra en logs sin datos personales. El texto «reintente más tarde» lo muestra la pantalla de acceso ante el error genérico.

### D2. IP confiable
`obtenerIp(headers)`: si `process.env.VERCEL` está definido, usa el primer valor de `x-vercel-forwarded-for` (Vercel lo sobrescribe), agrupando IPv6 por /64; si falta, cubo `desconocida`. Fuera de Vercel (dev/test) todas las solicitudes comparten el cubo `local`; `x-forwarded-for` y `x-real-ip` se ignoran siempre. El hash de la IP evita guardarla en claro. `authorize(credentials, request)` de Auth.js recibe la `Request` con las cabeceras.

### D3. Enumeración: hash de relleno
Se genera una vez por instancia (promesa memoizada) un hash Argon2id con los mismos parámetros por defecto que usa el seed, de una contraseña aleatoria. Si el usuario no existe se ejecuta `argon2.verify(relleno, password)` y se devuelve `null`. Tiempos: ambos caminos (usuario inexistente / contraseña incorrecta) hacen una lectura de usuario, dos reservas del limitador y una verificación Argon2id; la única rama rápida es el bloqueo, cuyo estado es equivalente para emails existentes e inexistentes (cada uno tiene su propio contador de 5, el genérico incluido), por lo que no revela la existencia de la cuenta. Costo: un hash adicional en el arranque en frío de la instancia, solo si llega un intento con email inexistente.

### D4. Sesión de 8 horas absoluta
`session: { strategy: "jwt", maxAge: 8h }` y, en `auth.config.ts` (la usa también el proxy), callback `jwt` que graba `authTime` al iniciar sesión y devuelve `null` si `ahora - authTime > 8h` o si el token no tiene `authTime` (un token anterior al cambio no se mide por `iat`: Auth.js lo reinicia en cada lectura y lo haría renovable); callback `session` coherente. Así la renovación deslizante de Auth.js (`updateAge`) no puede extender la sesión más allá de 8 h desde el login. Verificación en tarea: confirmar con la versión instalada de next-auth que un JWT sin `authTime` vigente se rechaza y que `null` desde el callback invalida la sesión.

### D5. Layouts privados
`app/dashboard/layout.tsx` y `app/propiedades/layout.tsx` llaman a una función `exigirSesionPagina()` (usa `auth()` y `redirect("/login")`). Con `cacheComponents: true`, leer cookies fuera de `<Suspense>` rompe el prerender: la comprobación se coloca en un componente servidor interno envuelto en `<Suspense>` con el mismo fallback que ya usa el layout (sin cambio visual). Riesgo y verificación en tareas (build).

### D6. Matcher exacto
`/((?!login$|login/|api/auth/|_next/static/|_next/image|favicon\\.ico$).*)`. Test que enumera rutas del árbol `app/` y un conjunto de rutas «parecidas» (`/login-admin`, `/api/authx`) frente al matcher.

### D7. Cabeceras y CSP
`headers()` en `next.config.ts` y `poweredByHeader: false`. CSP aplicada (no solo Report-Only): `default-src 'self'; script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` solo en desarrollo); `style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <host de S3_ENDPOINT>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. `'unsafe-inline'` en scripts se mantiene porque Next.js inyecta scripts de hidratación en línea y las alternativas con nonce obligan a renderizado dinámico, incompatible con `cacheComponents`/PPR; se compensa con la ausencia de `dangerouslySetInnerHTML` y con `frame-ancestors`/`object-src`/`base-uri` estrictos. Las directivas se limitan a lo que la aplicación usa (se verifica en la implementación que no hacen falta `blob:` ni fuentes remotas; solo se añade lo imprescindible). **Riesgo residual de `'unsafe-inline'`**: un XSS que lograra inyectar un `<script>` en línea no sería bloqueado por la CSP. Se mitiga con la ausencia de `dangerouslySetInnerHTML`, el escape por defecto de React, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` y `connect-src` acotado (limita la exfiltración), y se documenta en `docs/architecture.md`. Se construye en una función pura probada por unidad. El host de R2 sale de `S3_ENDPOINT` en tiempo de build. Si en la verificación manual del navegador la CSP rompiera algo, el plan de contingencia es cambiarla a `Content-Security-Policy-Report-Only` con una sola constante, sin tocar el resto.

### D8. CSRF por verificación de Origin en el proxy
Se implementa dentro del callback `authorized` (único punto que ya intercepta `/api/*` y las páginas), antes de la comprobación de sesión: para `POST|PUT|PATCH|DELETE` a **cualquier ruta interceptada** salvo `/api/auth/*` (cubre los 24 handlers y también un posible Server Action, que viaja como POST a una página), `Origin` debe estar en `APP_ORIGINS` (lista separada por comas; en desarrollo, por defecto `http://localhost:3000`); sin `Origin` se acepta solo `Sec-Fetch-Site: same-origin`. En producción sin `APP_ORIGINS` se rechaza todo (cierra por defecto). Responde 403 JSON. Misma ubicación: `Content-Length > 1 MiB` → 413. Ventaja: cero cambios en los 24 handlers. Una prueba enumera los métodos exportados de `app/api/**/route.ts` y falla si aparece uno distinto de `GET|POST|PUT|PATCH|DELETE` o si algún `GET` invoca una escritura; otra comprueba que no existen `"use server"` sin cobertura. El logout es `POST /api/auth/signout` con el token CSRF propio de Auth.js, que no se toca. Descartado: token CSRF propio (el frontend usa `fetch` same-origin; `Origin` + `SameSite=Lax` es suficiente para un MVP y no altera el CSRF de Auth.js).

### D9. Subida en dos fases con promoción y ETag fijado
Tabla `documento_subida` (reserva): `id`, `propiedad_id` (FK, cascade), `tipo`, `nombre_archivo`, `mime_type`, `tamano_bytes`, `clave_temporal` (única), `clave_definitiva` (única, generada al reservar), `estado` (`PENDIENTE | EN_PROCESO | COMPLETADA | EXPIRADA`), `expira_en`, `reclamada_en`, `documento_id` (nullable, único, FK `SetNull`), `creada_en`.

Flujo:
1. **Solicitar**: transacción con `pg_advisory_xact_lock(hashtext('documentos-cuota'))`; limpieza acotada de reservas vencidas; cómputo de documentos + reservas vigentes (propiedad y global); si cabe, inserta la reserva (`expira_en = now + 10 min`) y se firma la URL PUT (5 min) para `tmp/propiedades/{id}/{uuid}`. `tokenSubida = "{reservaId}.{expira}.{hmac}"` con HMAC-SHA256 sobre `reservaId|claveTemporal|mime|tamano|expira` y secreto `DOCUMENT_UPLOAD_SECRET` (sin fallback). El serializado global es aceptable para una demo de un solo usuario.
2. **Reclamar**: `UPDATE documento_subida SET estado='EN_PROCESO', reclamada_en=now() WHERE id=$1 AND expira_en>now() AND (estado='PENDIENTE' OR (estado='EN_PROCESO' AND reclamada_en < now() - 60 s)) RETURNING …`. Cero filas → si está COMPLETADA devuelve el documento existente (idempotencia, 200); si está EN_PROCESO vigente → 409; si venció → 422. Garantiza un solo ganador concurrente y token de un solo uso.
3. **Validar y fijar ETag**: `HEAD` de la clave temporal → tamaño, content-type, ETag `E`; lectura de los primeros bytes con GET (`If-Match: E` como optimización) **y comparación del ETag que devuelve esa misma respuesta con `E`**: si difiere (o 412), fallo de validación. Así los bytes validados proceden demostrablemente de la versión `E`, aunque R2 ignorase `If-Match`.
4. **Promover**: `CopyObject` a la clave definitiva con `x-amz-copy-source-if-match: <ETag>` (cabecera firmada en la prefirma). Si el temporal fue sobrescrito después de validar, la copia falla y nada se promueve. Después `HEAD` del definitivo: ETag y tamaño deben coincidir con `E` y el tamaño validado; si no, se borra el definitivo y se rechaza. **La garantía descansa en esa verificación y no en los condicionales**: con ETag = MD5 del contenido (32 hex; solo se acepta ese formato: un ETag débil o de multipart se rechaza y el objeto se descarta; cargas de una sola parte, como las de una URL PUT prefirmada), `definitivo == E` implica que los bytes promovidos son los de la versión `E` cuyos primeros bytes se validaron. Una copia o una lectura sobre otra versión produce un ETag distinto y se rechaza. Como el navegador no tiene ni tendrá URL de escritura para `propiedades/…`, el definitivo ya no es modificable por él.
5. **Registrar**: transacción que inserta `documento` (con la clave definitiva) y marca la reserva `COMPLETADA` con `documento_id`. Borrado del temporal en mejor esfuerzo.
6. **Fallos**: tras la copia, si falla el insert, se elimina el definitivo (mejor esfuerzo, error registrado) y la reserva vuelve a `PENDIENTE` si no venció; si falla el borrado del temporal queda huérfano y lo recoge la limpieza o el Lifecycle. Nunca queda fila sin objeto.
- **Supuesto no verificado y no dado por resuelto**: que R2 devuelva como ETag el MD5 del contenido en objetos subidos con una URL PUT prefirmada y que mantenga ese ETag en `CopyObject`. Sin R2 real no puede probarse aquí; si el supuesto fallara, el mecanismo no daría la garantía y habría que sustituirlo (p. ej. cabecera `x-amz-checksum-sha256` firmada en la subida y comparación del checksum). Queda como verificación manual **obligatoria** antes del despliegue (tarea 7.7); hasta entonces el riesgo se considera mitigado en código y pendiente de confirmación, no resuelto. La compatibilidad de R2 con `x-amz-copy-source-if-match` es una optimización adicional, no la base de la garantía.
- Alternativas descartadas: promover leyendo y reescribiendo los bytes desde la aplicación (el binario atravesaría Vercel y el límite de 4,5 MB); cerrar la ventana solo acortando la vida de la URL (no la elimina); borrar la URL no es posible (las prefirmadas no se revocan).
- Compatibilidad: el contrato de `/subida` y `/documentos` conserva `storageKey` y `tokenSubida`; el frontend no cambia. `storageKey` pasa a ser la clave temporal; los documentos existentes mantienen su clave definitiva con el mismo formato, así que lectura/borrado no cambian. Tras registrar, la API deja de exponer la clave del objeto (como hoy).

### D10. Cuotas
Constantes en `server/domain/documento.ts` (20 MB, 50 por propiedad, 200 MB por propiedad, 1 GB global). Cómputo: `SUM/COUNT` sobre `documento` más `documento_subida` con estado `PENDIENTE|EN_PROCESO` y `expira_en > now()`. La reserva vencida deja de contar sin necesidad de borrarla. Error 422 con mensaje que nombra la cuota.

### D11. Limpieza
Oportunista, en cada solicitud de subida y acotada a 20 filas: (a) reservas `PENDIENTE` o `EN_PROCESO` abandonadas (`reclamada_en` > 60 s) con `expira_en` anterior a 5 minutos atrás se **reclaman atómicamente** (`UPDATE … SET estado='EXPIRADA' … RETURNING`) antes de borrar nada, de modo que una confirmación en curso o una limpieza concurrente no pisen el mismo objeto; (b) se borran su objeto temporal y, solo si ningún `documento` referencia esa clave, el definitivo (mejor esfuerzo; los fallos se registran), y se elimina la fila; (c) las reservas `COMPLETADA` con más de un día se eliminan (solo la fila). Añade el estado `EXPIRADA` al enum. Respaldo: regla Lifecycle manual de R2 (expirar `tmp/` a 1 día; la granularidad mínima de R2 es de un día) documentada en `docs/architecture.md`. Sin cron.

### D12. Límites de entrada
`.max()` en los textos libres de `server/schemas/*` (nombres/notas 255, descripciones 1000, nombre de archivo 255); error 400 en vez de truncar. Listados sin cambios. El límite de 1 MiB del cuerpo vive en el proxy (D8).

### D13. Variables y build
Nuevas: `DOCUMENT_UPLOAD_SECRET` (obligatoria para subir; 503 si falta, sin fallback a `S3_SECRET_ACCESS_KEY` ni `AUTH_SECRET`) y `APP_ORIGINS`. `build` pasa a `prisma generate && next build`. Se añade validación al arranque solo como mensaje de error claro en los puntos que ya devuelven 503; no se introduce un sistema de configuración nuevo.

### D14. Dependencias
Sin cambios (Prisma sigue en 6.19.3; se preservan `next` 16.4.6 y `zod` 4.6.7; sin overrides ni `npm audit fix`). Se documentan deepmerge-ts, effect, `@prisma/config`/`prisma` (cadena del CLI, no cargada por `@prisma/client` en runtime; sin `prisma.config.ts`; `Schema.TemplateLiteral` no usado) y minimatch/ESLint (solo `npm run lint`) con la salida completa de `npm audit` y `npm audit --omit=dev` y la nota de que el audit filtrado `--omit=dev --omit=optional --omit=peer` (0 vulnerabilidades) oculta el peer opcional de `prisma` y no es prueba de ausencia de vulnerabilidades: se cita siempre junto con el audit completo, que hoy reporta 13 (8 moderadas y 5 altas, 4 de ellas en la cadena `prisma`/`@prisma/config`/`deepmerge-ts`/`effect`) y no se usa solo; el filtro el peer opcional de `prisma` y no debe citarse como ausencia de vulnerabilidades.

## Risks / Trade-offs

- [R2 ignora condicionales o su ETag no es el MD5] → la garantía se basa en comparar los ETag devueltos por la lectura y por el objeto definitivo con el fijado; si el ETag no fuera el MD5 del contenido la garantía no se cumple y no se da por resuelta: verificación manual obligatoria con R2 real (checklist) y alternativa de checksum SHA-256 firmado.
- [Prefirma de `CopyObject` con cabecera `x-amz-copy-source`] → el firmante ya admite cabeceras firmadas; se añade un test con ejemplo conocido de SigV4 y se comprueba a mano contra R2.
- [Serialización global por advisory lock en cuotas] → solo en solicitudes de subida de una demo de usuario único; sin impacto en el resto.
- [Bloqueo de la cuenta real por terceros] → aceptado; ventana de 15 min y umbral por IP; sin información adicional al atacante.
- [`auth()` en layouts bajo `cacheComponents`] → componente interno bajo `<Suspense>`; verificado con `next build`.
- [CSP con `'unsafe-inline'` en scripts] → mitigaciones listadas en D7 y plan de contingencia a Report-Only.
- [CSP rompe hidratación/gráficos/subida] → no se puede comprobar en navegador desde el sandbox: queda como verificación manual obligatoria pre-despliegue.
- [Limpieza oportunista no corre sin tráfico] → los objetos sin limpiar no cuentan para cuotas (reserva vencida) y el Lifecycle de 24 h es el respaldo.
- [Pruebas de integración requieren PostgreSQL] → se ejecutan localmente; si el sandbox no lo permite se informa sin declararlas exitosas.

## Migration Plan

1. Migración `login_intento` y migración `documento_subida` (+ enum de estado): aditivas, sin tocar datos; se entregan sin aplicar.
2. Orden de despliegue (pasos manuales del usuario): definir variables (`AUTH_SECRET`, `APP_ORIGINS`, `DOCUMENT_UPLOAD_SECRET`), aplicar migraciones con `prisma migrate deploy` en Neon, configurar CORS y la regla Lifecycle de R2, desplegar.
3. Reversión: las tablas nuevas son independientes; revertir el código vuelve al flujo anterior (los documentos registrados no cambian). Las reservas pendientes se pierden sin efecto.
4. Documentos existentes: ninguna migración de datos; claves y filas intactas.

## Open Questions

- Ninguna que bloquee. Pendiente de confirmar en el entorno real: soporte de `x-amz-copy-source-if-match` en R2 (D9) y comportamiento del callback `jwt` con `null` en la versión instalada de next-auth (D4); ambos tienen tarea de verificación.
