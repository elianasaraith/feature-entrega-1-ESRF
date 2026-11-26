# document-management Specification

## Purpose
Esta capability define la gestión de documentos de una propiedad (T11): metadata en PostgreSQL y archivos en un bucket privado S3-compatible (Cloudflare R2) tras el puerto `AlmacenDocumentos`. La subida es directa del navegador mediante URL firmada de vida corta y exige una autorización emitida por el servidor; antes de registrar, el servidor comprueba el objeto real (existencia, tamaño, `Content-Type` y firma de formato). Admite PDF, JPEG, PNG y WebP de hasta 20 MB, vínculos opcionales a crédito, contrato, abono o movimiento de la misma propiedad, listado, descarga por URL firmada y eliminación, todo bajo sesión. Un objeto huérfano se acepta y un almacenamiento no disponible responde 503.
## Requirements
### Requirement: Almacenamiento privado S3-compatible detrás de un puerto
El sistema SHALL acceder al almacenamiento solo a través de un puerto `AlmacenDocumentos` con URL firmada de subida, URL firmada de lectura, inspección del objeto (tamaño, tipo y ETag), lectura de sus primeros bytes condicionada al ETag, copia condicionada al ETag y borrado. El bucket SHALL ser privado y toda URL emitida SHALL ser firmada y de vida corta (5 minutos). Las URL firmadas de subida SHALL emitirse solo para claves del prefijo temporal `tmp/propiedades/{propiedadId}/`; el sistema SHALL NOT emitir nunca una URL de escritura para una clave definitiva. Las credenciales SHALL leerse solo de variables de entorno del servidor y SHALL NOT enviarse al frontend ni persistirse. PostgreSQL SHALL guardar solo metadata y el sistema SHALL NOT usar el sistema de archivos local como almacenamiento. Si el almacenamiento no está configurado o falla, las operaciones que lo requieren SHALL responder 503 con un mensaje explícito.

#### Scenario: Proveedor sustituible
- **WHEN** las pruebas inyectan un almacenamiento simulado
- **THEN** el servicio de documentos funciona sin ninguna llamada de red

#### Scenario: Almacenamiento no configurado
- **WHEN** faltan las variables de entorno del almacenamiento y se solicita una subida
- **THEN** responde 503 sin crear ninguna fila ni reserva

#### Scenario: Firma verificada
- **WHEN** se firma la solicitud de ejemplo publicada por AWS para SigV4 por query string
- **THEN** la firma obtenida coincide con la publicada

#### Scenario: Sin escritura sobre claves definitivas
- **WHEN** se solicita cualquier subida
- **THEN** la URL de escritura emitida apunta a una clave bajo `tmp/` y ninguna URL de escritura apunta a una clave bajo `propiedades/`

#### Scenario: Copia condicionada al ETag
- **WHEN** el objeto temporal cambia después de haber sido validado y se solicita la copia con el ETag validado
- **THEN** la copia se rechaza y no se crea el objeto definitivo

### Requirement: Subida directa con validación previa
`POST /api/propiedades/{id}/documentos/subida` SHALL validar `tipo` (`ESCRITURA`, `CONTRATO_HIPOTECARIO`, `CONTRATO_ARRIENDO`, `COMPROBANTE_PAGO`, `FACTURA`, `OTRO`), `nombreArchivo`, `mimeType` y `tamanoBytes`, aplicar las cuotas, crear en una transacción una reserva de subida de un solo uso y devolver una URL de subida firmada (con `Content-Type` y `Content-Length` firmados) para una clave temporal `tmp/propiedades/{propiedadId}/{uuid}`, esa clave como `storageKey` y un `tokenSubida`. El `tokenSubida` SHALL ser una firma HMAC con el secreto independiente `DOCUMENT_UPLOAD_SECRET` sobre el identificador de la reserva, la clave, el tipo y el tamaño autorizados, con vigencia de 10 minutos. El formato permitido SHALL ser PDF, JPEG, PNG o WebP y el tamaño máximo 20 MB (parámetros únicos y configurables en el código). El binario SHALL NOT atravesar la aplicación. Si falta `DOCUMENT_UPLOAD_SECRET`, SHALL responder 503 sin usar ningún otro secreto.

#### Scenario: Solicitud válida
- **WHEN** se solicita la subida de un PDF de 2 MB de una propiedad existente dentro de las cuotas
- **THEN** responde 200 con `storageKey` temporal, `tokenSubida` y una URL firmada de subida, y existe una reserva pendiente

#### Scenario: Formato no permitido
- **WHEN** el `mimeType` no es uno de los permitidos
- **THEN** responde 400 y no emite URL ni reserva

#### Scenario: Tamaño inválido
- **WHEN** `tamanoBytes` es 0, negativo o mayor que 20 MB
- **THEN** responde 400 y no emite URL ni reserva

#### Scenario: Propiedad inexistente
- **WHEN** la propiedad no existe o el id no es UUID
- **THEN** responde 404

#### Scenario: Secreto de subida ausente
- **WHEN** `DOCUMENT_UPLOAD_SECRET` no está configurado
- **THEN** responde 503 y no crea reserva

### Requirement: Registro de la metadata tras comprobar el objeto
`POST /api/propiedades/{id}/documentos` SHALL exigir el `tokenSubida` emitido por el servidor y SHALL consumir la reserva asociada de forma atómica y de un solo uso. El sistema SHALL validar que `storageKey` tenga exactamente la forma `tmp/propiedades/{id}/{uuid}`, que coincida con la reserva y con la propiedad de la URL y que el token sea válido para esa clave, tipo y tamaño. Luego SHALL inspeccionar el objeto temporal y fijar su ETag; comprobar, según lo que lee del almacenamiento y no según lo declarado por el cliente, que existe, que su tamaño y `Content-Type` coinciden con lo autorizado y que los primeros bytes corresponden al formato (PDF `%PDF-`, JPEG `FF D8 FF`, PNG, WebP `RIFF…WEBP`); promoverlo con una copia condicionada al mismo ETag a una clave definitiva `propiedades/{propiedadId}/{uuid}` distinta; verificar que la respuesta de la lectura de los primeros bytes y la del objeto definitivo devuelven el mismo ETag fijado y que su tamaño coincide (sin depender de que el almacenamiento respete las cabeceras condicionales); insertar la fila de `documento` con la clave definitiva; completar la reserva; y eliminar el objeto temporal. Un objeto que no cumple SHALL descartarse del almacenamiento. Cada documento SHALL pertenecer a una propiedad y, opcionalmente, a un único vínculo entre crédito, contrato, abono o movimiento, que SHALL pertenecer a la misma propiedad. La base SHALL rechazar más de un vínculo específico y `tamano_bytes` ≤ 0. La respuesta SHALL NOT exponer la clave del objeto.

#### Scenario: Registro correcto
- **WHEN** el objeto fue subido con la URL emitida y se registra con el token recibido
- **THEN** responde 201 con el documento, el objeto existe bajo una clave definitiva distinta de la temporal, el temporal se elimina y se guarda la fila con la clave definitiva

#### Scenario: Clave no emitida por el servidor
- **WHEN** se registra una clave inventada o con un token falso, ajeno o vencido
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Clave con forma inválida o de otra propiedad
- **WHEN** el `storageKey` no cumple la forma `tmp/propiedades/{id}/{uuid}`, contiene segmentos de ruta como `..` o pertenece a otra propiedad
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Autorización de otro tipo o tamaño
- **WHEN** se registra con un tipo o tamaño distintos de los autorizados por el token
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Objeto inexistente
- **WHEN** el objeto temporal no está en el almacenamiento
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Tamaño o Content-Type distintos
- **WHEN** el objeto almacenado difiere en tamaño o `Content-Type` de lo autorizado
- **THEN** responde 422, el objeto se descarta y no se inserta ninguna fila

#### Scenario: Contenido que no corresponde al formato
- **WHEN** los primeros bytes del objeto no corresponden al tipo declarado (p. ej. HTML subido como PDF)
- **THEN** responde 422, el objeto se descarta y no se inserta ninguna fila

#### Scenario: Vínculo de otra propiedad
- **WHEN** el contrato, crédito, abono o movimiento indicado pertenece a otra propiedad
- **THEN** responde 422 y no se inserta ninguna fila

#### Scenario: Registro repetido idempotente
- **WHEN** se registra de nuevo con el mismo token una subida ya completada
- **THEN** responde 200 con el mismo documento, sin crear otra fila ni otro objeto

#### Scenario: Registro concurrente con el mismo token
- **WHEN** dos solicitudes simultáneas confirman la misma reserva
- **THEN** solo una promueve el objeto y crea la fila y la otra responde 409 o el documento ya creado, nunca dos filas

#### Scenario: Sobrescritura del temporal tras validar
- **WHEN** el navegador sobrescribe el objeto temporal con la URL de subida aún vigente entre la validación y la promoción
- **THEN** la copia condicionada falla, no se crea objeto definitivo ni fila, y el objeto no validado nunca se promueve

#### Scenario: ETag que no identifica el contenido
- **WHEN** el almacenamiento devuelve un ETag débil o de carga multiparte
- **THEN** el objeto se descarta, responde 503 y no se promueve

#### Scenario: Almacenamiento que ignora las condiciones
- **WHEN** el almacenamiento ignora `If-Match` y `x-amz-copy-source-if-match` y el objeto temporal cambia entre la inspección, la lectura de bytes y la copia
- **THEN** los ETag devueltos por la lectura o por el objeto definitivo difieren del fijado, la promoción se rechaza y el objeto definitivo se elimina

#### Scenario: Reutilización de la URL de subida tras registrar
- **WHEN** se usa la URL firmada de subida después de completado el registro
- **THEN** solo puede escribir sobre la clave temporal ya eliminada y el objeto definitivo registrado no cambia

#### Scenario: Dos vínculos
- **WHEN** la base recibe una fila con dos vínculos específicos
- **THEN** la restricción CHECK la rechaza

#### Scenario: Documentos anteriores
- **WHEN** existe un documento registrado antes de este cambio con clave `propiedades/{propiedadId}/{uuid}`
- **THEN** su listado, descarga y eliminación funcionan sin cambios

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

### Requirement: Cuotas de almacenamiento de documentos con reservas
El sistema SHALL aplicar estas cuotas al solicitar una subida: 20 MB por documento, 50 documentos por propiedad, 200 MB por propiedad y 1 GB global de documentos. Los cómputos SHALL incluir los documentos registrados y las reservas de subida pendientes y vigentes, SHALL excluir las reservas vencidas y SHALL evaluarse y reservarse de forma atómica en una única transacción serializada, de modo que solicitudes concurrentes no superen ninguna cuota. Los parámetros SHALL definirse en un único lugar del código. Una solicitud que supere una cuota SHALL responder 422 con un mensaje que indique cuál, sin emitir URL ni crear reserva. Las cuotas SHALL NOT afectar a los documentos ya registrados.

#### Scenario: Límite de documentos por propiedad
- **WHEN** una propiedad tiene 50 documentos entre registrados y reservas vigentes y se solicita otra subida
- **THEN** responde 422 y no crea reserva ni URL

#### Scenario: Límite de bytes por propiedad
- **WHEN** la suma de bytes registrados y reservados de la propiedad más el nuevo archivo superaría 200 MB
- **THEN** responde 422 y no crea reserva

#### Scenario: Límite global
- **WHEN** la suma global de bytes registrados y reservados más el nuevo archivo superaría 1 GB
- **THEN** responde 422 y no crea reserva

#### Scenario: Solicitudes simultáneas en el límite
- **WHEN** quedan 5 MB de cupo y dos solicitudes simultáneas piden 4 MB cada una
- **THEN** solo una obtiene reserva y la otra responde 422

#### Scenario: Reserva vencida libera cupo
- **WHEN** una reserva venció sin confirmarse y se solicita una subida que de otro modo excedería la cuota
- **THEN** el cupo de la reserva vencida no se cuenta y la solicitud se acepta

#### Scenario: Documentos previos intactos
- **WHEN** existen documentos registrados antes de introducir las cuotas, aunque excedan alguna
- **THEN** siguen listándose, descargándose y eliminándose; solo se rechazan las subidas nuevas que superen la cuota

### Requirement: Limpieza de objetos temporales y reservas vencidas
El sistema SHALL eliminar de forma oportunista, acotada a un número fijo por ejecución, las reservas vencidas no completadas y sus objetos temporales, tras reclamarlas atómicamente (estado `EXPIRADA`) con un margen posterior al vencimiento para no interferir con confirmaciones en curso, y las reservas completadas con más de un día de antigüedad (solo la fila de reserva). SHALL NOT eliminar nunca un objeto definitivo referenciado por un `documento`, y SHALL documentar una regla Lifecycle de Cloudflare R2 que expire los objetos del prefijo `tmp/` a las 24 horas como respaldo. El sistema SHALL NOT requerir una tarea programada para el funcionamiento correcto.

#### Scenario: Reserva vencida
- **WHEN** se solicita una subida y existen reservas vencidas sin completar
- **THEN** el sistema elimina hasta el máximo fijado de ellas junto con su objeto temporal, sin fallar si el borrado del objeto falla

#### Scenario: Limpieza concurrente con una confirmación
- **WHEN** la limpieza coincide con una confirmación que sigue en curso de la misma reserva
- **THEN** la limpieza no reclama la reserva ni borra sus objetos

#### Scenario: Objeto definitivo referenciado
- **WHEN** la limpieza procesa una reserva cuya clave definitiva está referenciada por un documento
- **THEN** no borra el objeto definitivo

#### Scenario: Reservas completadas antiguas
- **WHEN** existen reservas completadas con más de un día
- **THEN** la limpieza las elimina sin afectar a los documentos

#### Scenario: Regla Lifecycle documentada
- **WHEN** se consulta la documentación de despliegue
- **THEN** describe la regla manual de expiración a 24 horas del prefijo `tmp/`

### Requirement: Tolerancia a fallos parciales entre PostgreSQL y almacenamiento
El sistema SHALL garantizar que ningún documento registrado referencie un objeto inexistente. Si la promoción del objeto o la inserción de la fila fallan, el sistema SHALL revertir lo parcial (eliminar el objeto definitivo creado, devolver la reserva a pendiente si sigue vigente) y SHALL registrar el error. Una reserva en proceso abandonada SHALL poder reclamarse de nuevo transcurrido un plazo corto.

#### Scenario: Falla la inserción tras promover
- **WHEN** el objeto se promovió pero la inserción de la fila falla
- **THEN** se elimina el objeto definitivo, no queda fila y la reserva vuelve a pendiente si no venció

#### Scenario: Falla la promoción
- **WHEN** la copia al almacenamiento falla
- **THEN** no se inserta fila, no queda objeto definitivo y el error es 503 para el usuario

#### Scenario: Confirmación abandonada
- **WHEN** una confirmación quedó en proceso y superó el plazo de reclamación sin completarse
- **THEN** otra confirmación con el mismo token puede reclamarla

