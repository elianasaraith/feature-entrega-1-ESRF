## 1. Datos

- [x] 1.1 Modelo `Documento` y enum `TipoDocumento` en el esquema Prisma; migración nueva con CHECK de exclusividad y `tamano_bytes > 0` (no aplicada)

## 2. Almacenamiento

- [x] 2.1 Puerto `AlmacenDocumentos` y doble en memoria para pruebas
- [x] 2.2 Firma SigV4 por query string con `node:crypto` y almacén S3-compatible configurado por entorno (503 si falta configuración)

## 3. Servicio y API

- [x] 3.1 Reglas de formato y tamaño (`server/domain/documento.ts`) y esquemas zod
- [x] 3.2 `documentoService`: solicitarSubida, registrar, listar, urlLectura, eliminar; `ServiceUnavailableError` (503) en `server/errors.ts`
- [x] 3.3 Rutas protegidas bajo `app/api/propiedades/[id]/documentos`

## 4. Interfaz

- [x] 4.1 Página `/propiedades/[id]/documentos` con lista, subida directa, descarga y eliminación, y enlace desde el detalle de la propiedad

## 5. Endurecimiento (revisión de seguridad)

- [x] 5.1 `tokenSubida` firmado por el servidor (clave, tipo, tamaño, vencimiento) exigido al registrar
- [x] 5.2 Inspección del objeto (tamaño, `Content-Type`) y firma de formato por lectura de los primeros bytes; descarte del objeto inválido
- [x] 5.3 Pruebas: token falso/ajeno/vencido, otro tipo o tamaño, HTML disfrazado de PDF, descarte del objeto, borrado huérfano sin credenciales en logs

## 6. Pruebas y verificación

- [x] 6.1 Vector oficial AWS de SigV4 y reglas de formato/tamaño
- [x] 6.2 Servicio con almacén y Prisma simulados: registro correcto, objeto inexistente, tamaño distinto, clave ajena, vínculo ajeno, duplicado, eliminación con fallo de almacenamiento, listado
- [x] 6.3 Prueba de integración de la restricción CHECK (se omite sin `TEST_DATABASE_URL`)
- [x] 6.4 tsc, ESLint, build, suite y `openspec validate t11-gestion-documentos --strict`
