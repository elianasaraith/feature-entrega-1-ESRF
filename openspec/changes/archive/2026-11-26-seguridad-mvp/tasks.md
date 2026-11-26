## 1. Preparación y esquema de base de datos

- [x] 1.1 Cambiar el script `build` de `package.json` a `prisma generate && next build` (sin tocar dependencias)
- [x] 1.2 Añadir a `prisma/schema.prisma` el modelo `LoginIntento` (`login_intento`: clave PK, contador, ventana_inicio, actualizado_en)
- [x] 1.3 Añadir el enum `EstadoSubida` y el modelo `DocumentoSubida` (`documento_subida`) con claves temporal y definitiva únicas, `expira_en`, `reclamada_en`, `documento_id` único opcional y los índices necesarios para las cuotas
- [x] 1.4 Crear las dos migraciones SQL aditivas con `prisma migrate dev --create-only` o a mano, sin aplicarlas; CHECK de `contador >= 0` y `tamano_bytes > 0`
- [x] 1.5 Ejecutar `prisma validate` y `prisma generate` y confirmar que el esquema y el cliente compilan

## 2. Autenticación: límite de intentos, enumeración y sesión

- [x] 2.1 Crear `server/auth/login-limiter.ts`: constantes (5 por cuenta, 20 por IP, 15 min), claves con hash, reserva atómica `INSERT … ON CONFLICT … RETURNING`, reinicio de cuenta tras éxito y limpieza acotada de registros vencidos
- [x] 2.2 Crear `obtenerIp(headers)` con `x-vercel-forwarded-for` solo si `VERCEL` está definido, cubo `local` fuera de Vercel e ignorando `x-forwarded-for`/`x-real-ip`
- [x] 2.3 Ajustar `verify-credentials.ts`: normalización del email (recorte, minúsculas, máximo 254), hash Argon2id de relleno memoizado, verificación también para emails inexistentes, clave de cuenta genérica para emails inexistentes y orden reservar→verificar
- [x] 2.4 Ajustar `auth.ts` para pasar la `Request` a `authorize`, devolver `null` (error genérico) al superar el límite sin ejecutar Argon2 registrar el bloqueo sin datos personales y denegar con el mismo error genérico si PostgreSQL falla (cierre por defecto)
- [x] 2.5 Configurar `session.maxAge` de 8 h y los callbacks `jwt`/`session` en `auth.config.ts` con `authTime` y expiración absoluta; actualizar el comentario obsoleto de `auth.ts`
- [x] 2.6 Verificar contra la versión instalada de next-auth que un token vencido por `authTime` deja la sesión como no autenticada y que `updateAge` no la extiende
- [x] 2.7 Mostrar en la pantalla de acceso un mensaje genérico de «demasiados intentos o credenciales inválidas» sin distinguir la causa

## 3. Proxy, layouts, cabeceras y CSRF

- [x] 3.1 Reemplazar el matcher de `proxy.ts` por el patrón exacto y actualizar su comentario
- [x] 3.2 Añadir en el callback `authorized` la verificación de `Origin`/`Sec-Fetch-Site` contra `APP_ORIGINS` para toda mutación interceptada por el proxy (403 JSON, cierre por defecto en producción, excluyendo `/api/auth/*` y `GET`/`HEAD`) y el límite de `Content-Length` de 1 MiB (413)
- [x] 3.3 Crear `exigirSesionPagina()` y aplicarlo en `app/dashboard/layout.tsx` y `app/propiedades/layout.tsx` dentro de `<Suspense>` compatible con `cacheComponents`, sin cambio visual
- [x] 3.4 Crear la función pura que construye la CSP (host de `S3_ENDPOINT`, `unsafe-eval` solo en desarrollo) y añadir `headers()` y `poweredByHeader: false` en `next.config.ts`
- [x] 3.5 Añadir `.max()` explícitos a los textos libres de `server/schemas/*` (nombres, notas, descripciones, nombre de archivo) sin tocar listados ni contratos

## 4. Documentos: puerto de almacenamiento y reservas

- [x] 4.1 Ampliar `server/storage/almacen.ts` con `ETag` en `inspeccionar`, `leerInicio(clave, n, etag)` que devuelva también el ETag de su respuesta, y `copiarCondicional(origen, destino, etag)`; mantener la compatibilidad con los dobles de prueba
- [x] 4.2 Implementar en `s3-almacen.ts` la lectura con `If-Match` y la copia con `x-amz-copy-source` y `x-amz-copy-source-if-match` firmadas, el `HEAD` con ETag y el tratamiento de 412 como fallo de validación
- [x] 4.3 Añadir prueba de firma SigV4 para una solicitud con cabeceras `x-amz-copy-source*` y asegurar que ninguna URL PUT se emite para claves fuera de `tmp/propiedades/{id}/`
- [x] 4.4 Extender `server/domain/documento.ts` con las cuotas (50, 200 MB, 1 GB), la expresión regular estricta de la clave temporal y las funciones de claves temporal y definitiva; añadir `EXPIRADA` al enum de estados
- [x] 4.5 Sustituir el fallback de secreto en `server/services/index.ts` por `DOCUMENT_UPLOAD_SECRET` sin alternativa (503 si falta) y ajustar `RegistroInput` en `server/schemas/documento.ts`
- [x] 4.6 Implementar en `documento-service.ts` la solicitud de subida: transacción con lock advisory global, limpieza acotada de reservas vencidas, cómputo de cuotas con reservas vigentes, inserción de la reserva y token HMAC con id de reserva
- [x] 4.7 Implementar el registro: validación de forma de clave y token, reclamación atómica de la reserva, idempotencia para reservas completadas, 409 para reclamación vigente y 422 para vencidas
- [x] 4.8 Implementar validación con ETag fijado (comparando el ETag de la propia lectura de bytes), copia condicional, verificación posterior del ETag y tamaño del definitivo, inserción de `documento` con la clave definitiva, cierre de la reserva y borrado del temporal
- [x] 4.9 Implementar la reversión de fallos parciales: borrar el definitivo si falla el insert, devolver la reserva a pendiente si sigue vigente y registrar errores
- [x] 4.10 Implementar la limpieza oportunista descrita en D11 (reclamación atómica a `EXPIRADA`, margen de 5 minutos, no borrar definitivos referenciados, reservas completadas antiguas)
- [x] 4.11 Mantener sin cambios `listar`, `urlLectura` y `eliminar` y comprobar que funcionan con documentos anteriores

## 5. Pruebas

- [x] 5.1 Pruebas unitarias del limitador: por cuenta, por IP, usuario inexistente, expiración de ventana, reinicio tras éxito y limpieza acotada
- [x] 5.2 Prueba de integración de concurrencia del limitador (50 intentos simultáneos, como máximo 5 verifican) contra PostgreSQL local
- [x] 5.3 Pruebas de `obtenerIp`, de enumeración (hash de relleno y mensajes idénticos) y de duración absoluta de sesión
- [x] 5.4 Ampliar `tests/auth/proxy.test.ts` con matcher exacto, rutas parecidas, 401, 403 por origen (API y páginas), `Sec-Fetch-Site`, `/api/auth/*` intacto, 413, layouts privados, y una prueba que enumere los métodos exportados de `app/api/**/route.ts` y la ausencia de `"use server"`
- [x] 5.5 Pruebas de la CSP y las cabeceras (función pura y configuración de Next)
- [x] 5.6 Pruebas de servicio con almacén simulado: cuotas (documentos, bytes por propiedad, global, reservas simultáneas y vencidas), reserva de un solo uso, registro idempotente y concurrente, token ajeno o vencido, clave inválida, sobrescritura del temporal entre validación y copia, almacén que ignora las condiciones (ETag distinto en lectura o definitivo), limpieza concurrente con confirmación y sin borrar definitivos referenciados, y borrado del definitivo si falla el insert
- [x] 5.7 Prueba de compatibilidad con documentos registrados antes del cambio (listar, descargar, eliminar) y de que ninguna URL PUT apunta a `propiedades/`
- [x] 5.8 Ejecutar los tests afectados y la suite completa sin omitir ni debilitar pruebas existentes; informar lo que el sandbox no permita ejecutar

## 6. Verificación y revisión

- [x] 6.1 Ejecutar TypeScript (`tsc --noEmit`), ESLint, `prisma validate`/`generate` y `next build`
- [x] 6.2 Ejecutar `openspec validate seguridad-mvp --strict`
- [x] 6.3 Revisión independiente de los cambios con `/security-review` o un subagente de seguridad de solo lectura; corregir hallazgos bloqueantes y documentar el resto

## 7. Documentación y despliegue

- [x] 7.1 Actualizar `.env.example` con `APP_ORIGINS` y `DOCUMENT_UPLOAD_SECRET` sin valores sensibles e indicar las obligatorias en producción (validado localmente por el usuario: `grep -c` devolvió 2; no verificable desde el sandbox)
- [x] 7.2 Actualizar `docs/architecture.md` y `docs/data-model.md` con el flujo de dos fases, las tablas `login_intento` y `documento_subida`, las cuotas, la política de cabeceras y la limpieza
- [x] 7.3 Documentar en `readme.md` (versión integrada) protecciones, variables nuevas, migraciones pendientes, limitaciones del MVP y verificaciones previas al despliegue
- [x] 7.4 Documentar la configuración manual de R2: regla Lifecycle de 24 h sobre `tmp/` y CORS del bucket para el origen de la app
- [x] 7.5 Documentar el riesgo residual de dependencias con la salida completa de `npm audit` y `npm audit --omit=dev` y la evidencia de alcanzabilidad, sin presentar el audit filtrado como ausencia de vulnerabilidades
- [x] 7.6 Registrar los prompts del trabajo en `prompts.md` (máximo 3 por sección)
- [x] 7.7 Redactar la lista de comprobaciones manuales pendientes (CSP en navegador; en R2 real: que el ETag de un objeto subido con URL prefirmada sea el MD5 de su contenido y se conserve tras `CopyObject`, y si se respeta `x-amz-copy-source-if-match`; cookies y `AUTH_SECRET` en Vercel, `sslmode=require`) y los pasos exactos para aplicar migraciones
