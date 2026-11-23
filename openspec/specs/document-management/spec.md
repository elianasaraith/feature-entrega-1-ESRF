# document-management Specification

## Purpose
Esta capability define la gestión de documentos de una propiedad (T11): metadata en PostgreSQL y archivos en un bucket privado S3-compatible (Cloudflare R2) tras el puerto `AlmacenDocumentos`. La subida es directa del navegador mediante URL firmada de vida corta y exige una autorización emitida por el servidor; antes de registrar, el servidor comprueba el objeto real (existencia, tamaño, `Content-Type` y firma de formato). Admite PDF, JPEG, PNG y WebP de hasta 20 MB, vínculos opcionales a crédito, contrato, abono o movimiento de la misma propiedad, listado, descarga por URL firmada y eliminación, todo bajo sesión. Un objeto huérfano se acepta y un almacenamiento no disponible responde 503.
## Requirements
### Requirement: Almacenamiento privado S3-compatible detrás de un puerto
El sistema SHALL acceder al almacenamiento solo a través de un puerto `AlmacenDocumentos` con URL firmada de subida, URL firmada de lectura, inspección del objeto (tamaño y tipo), lectura de sus primeros bytes y borrado. El bucket SHALL ser privado y toda URL emitida SHALL ser firmada y de vida corta (5 minutos). Las credenciales SHALL leerse solo de variables de entorno del servidor y SHALL NOT enviarse al frontend ni persistirse. PostgreSQL SHALL guardar solo metadata y el sistema SHALL NOT usar el sistema de archivos local como almacenamiento. Si el almacenamiento no está configurado o falla, las operaciones que lo requieren SHALL responder 503 con un mensaje explícito.

#### Scenario: Proveedor sustituible
- **WHEN** las pruebas inyectan un almacenamiento simulado
- **THEN** el servicio de documentos funciona sin ninguna llamada de red

#### Scenario: Almacenamiento no configurado
- **WHEN** faltan las variables de entorno del almacenamiento y se solicita una subida
- **THEN** responde 503 sin crear ninguna fila

#### Scenario: Firma verificada
- **WHEN** se firma la solicitud de ejemplo publicada por AWS para SigV4 por query string
- **THEN** la firma obtenida coincide con la publicada

### Requirement: Subida directa con validación previa
`POST /api/propiedades/{id}/documentos/subida` SHALL validar `tipo` (`ESCRITURA`, `CONTRATO_HIPOTECARIO`, `CONTRATO_ARRIENDO`, `COMPROBANTE_PAGO`, `FACTURA`, `OTRO`), `nombreArchivo`, `mimeType` y `tamanoBytes`, y SHALL devolver una URL de subida firmada (con `Content-Type` y `Content-Length` firmados), la clave `propiedades/{propiedadId}/{uuid}` y un `tokenSubida`. El formato permitido SHALL ser PDF, JPEG, PNG o WebP y el tamaño máximo 20 MB (parámetros únicos y configurables en el código). El binario SHALL NOT atravesar la aplicación.

#### Scenario: Solicitud válida
- **WHEN** se solicita la subida de un PDF de 2 MB de una propiedad existente
- **THEN** responde 200 con `storageKey` y una URL firmada de subida

#### Scenario: Formato no permitido
- **WHEN** el `mimeType` no es uno de los permitidos
- **THEN** responde 400 y no emite URL

#### Scenario: Tamaño inválido
- **WHEN** `tamanoBytes` es 0, negativo o mayor que 20 MB
- **THEN** responde 400 y no emite URL

#### Scenario: Propiedad inexistente
- **WHEN** la propiedad no existe o el id no es UUID
- **THEN** responde 404

### Requirement: Registro de la metadata tras comprobar el objeto
`POST /api/propiedades/{id}/documentos` SHALL exigir el `tokenSubida` emitido por el servidor al solicitar la subida: una firma HMAC con secreto del servidor sobre la clave, el tipo y el tamaño autorizados, que vence a los 10 minutos. El sistema SHALL insertar la fila de `documento` solo si el token es válido, el `storageKey` pertenece a esa propiedad y el objeto almacenado cumple, según lo que lee el servidor del almacenamiento y no según lo declarado por el cliente: existe, su tamaño y su `Content-Type` coinciden con lo autorizado y los primeros bytes corresponden al formato (PDF `%PDF-`, JPEG `FF D8 FF`, PNG, WebP `RIFF…WEBP`). Un objeto que no cumple SHALL descartarse del almacenamiento. Cada documento SHALL pertenecer a una propiedad y, opcionalmente, a un único vínculo entre crédito, contrato, abono o movimiento, que SHALL pertenecer a la misma propiedad. La base SHALL rechazar más de un vínculo específico y `tamano_bytes` ≤ 0.

#### Scenario: Registro correcto
- **WHEN** el objeto fue subido con la URL emitida y se registra con el token recibido
- **THEN** responde 201 con el documento (sin exponer la clave del objeto) y se guarda la fila

#### Scenario: Clave no emitida por el servidor
- **WHEN** se registra una clave inventada o con un token falso, ajeno o vencido
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Autorización de otro tipo o tamaño
- **WHEN** se registra con un tipo o tamaño distintos de los autorizados por el token
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Objeto inexistente
- **WHEN** el objeto no está en el almacenamiento
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Tamaño o Content-Type distintos
- **WHEN** el objeto almacenado difiere en tamaño o `Content-Type` de lo autorizado
- **THEN** responde 422, el objeto se descarta y no se inserta ninguna fila

#### Scenario: Contenido que no corresponde al formato
- **WHEN** los primeros bytes del objeto no corresponden al tipo declarado (p. ej. HTML subido como PDF)
- **THEN** responde 422, el objeto se descarta y no se inserta ninguna fila

#### Scenario: Clave de otra propiedad
- **WHEN** el `storageKey` no empieza por `propiedades/{id}/`
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Vínculo de otra propiedad
- **WHEN** el contrato, crédito, abono o movimiento indicado pertenece a otra propiedad
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Registro repetido
- **WHEN** se registra dos veces el mismo `storageKey`
- **THEN** la segunda responde 409

#### Scenario: Dos vínculos
- **WHEN** la base recibe una fila con dos vínculos específicos
- **THEN** la restricción CHECK la rechaza

### Requirement: Consulta, descarga y eliminación
`GET /api/propiedades/{id}/documentos` SHALL listar los documentos de la propiedad, de cualquier vínculo, con una sola consulta, más recientes primero. `GET /api/propiedades/{id}/documentos/{docId}` SHALL devolver una URL firmada de lectura con el nombre original como nombre de descarga. `DELETE` sobre ese recurso SHALL eliminar la fila y luego el objeto; si el borrado del objeto falla, SHALL registrar el error y completarse, sin dejar metadata sin archivo.

#### Scenario: Listado
- **WHEN** una propiedad tiene documentos propios y vinculados a su contrato
- **THEN** el listado devuelve todos con su tipo y vínculo, y no incluye los de otras propiedades

#### Scenario: URL de lectura
- **WHEN** se solicita un documento existente
- **THEN** responde 200 con una URL firmada de lectura de vida corta

#### Scenario: Documento de otra propiedad
- **WHEN** el documento existe pero pertenece a otra propiedad
- **THEN** responde 404

#### Scenario: Eliminación con fallo de almacenamiento
- **WHEN** el borrado del objeto falla
- **THEN** la fila queda eliminada y la respuesta es 200

### Requirement: Acceso protegido e interfaz mínima
Todos los endpoints de documentos SHALL exigir sesión (401 sin ella). La página `/propiedades/{id}/documentos` SHALL permitir listar, subir (archivo, tipo y vínculo propiedad, crédito o contrato), descargar y eliminar con confirmación, mostrando los errores del servidor.

#### Scenario: Sin sesión
- **WHEN** se llama a cualquier endpoint de documentos sin sesión
- **THEN** responde 401 y no devuelve URLs ni datos

#### Scenario: Subida desde la interfaz
- **WHEN** el usuario elige un archivo válido y lo envía
- **THEN** se solicita la URL, el navegador sube el archivo directamente al almacenamiento, se registra la metadata y el documento aparece en la lista

