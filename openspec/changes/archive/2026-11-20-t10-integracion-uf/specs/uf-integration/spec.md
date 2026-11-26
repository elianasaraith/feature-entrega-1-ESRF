## ADDED Requirements

### Requirement: Puerto ProveedorUf independiente del proveedor HTTP
El sistema SHALL definir un puerto `ProveedorUf` con una única operación: obtener el valor de la UF para una fecha (`YYYY-MM-DD`). El servicio de UF SHALL depender solo de ese puerto. La implementación concreta SHALL consultar `GET {UF_API_BASE_URL}/{dd-mm-yyyy}` (por defecto `https://findic.cl/api/uf`) únicamente desde el backend, y SHALL NOT llamarse desde componentes de interfaz.

#### Scenario: Proveedor sustituible
- **WHEN** las pruebas inyectan un doble de `ProveedorUf`
- **THEN** el servicio de UF funciona sin realizar ninguna llamada HTTP

#### Scenario: Fecha en el formato del proveedor
- **WHEN** se solicita la UF del 2026-03-01
- **THEN** la implementación HTTP consulta `/01-03-2026`

### Requirement: Validación estricta de la respuesta del proveedor
La implementación HTTP SHALL aceptar una respuesta solo si el estado HTTP es 2xx, el cuerpo es JSON, `serie` es un arreglo con exactamente un elemento, `serie[0].fecha` coincide con la fecha solicitada y `serie[0].valor` es un número JSON finito mayor que 0, validado con Zod, compatible con 2 decimales y con `NUMERIC(12,2)`. El valor SHALL convertirse a `Decimal` inmediatamente tras la validación y SHALL persistirse y operarse como `Decimal`; el sistema SHALL NOT realizar operaciones monetarias con `number` ni añadir parsers o dependencias para ello. Una consulta SHALL fallar por timeout si no responde en 5 segundos.

#### Scenario: Respuesta válida
- **WHEN** el proveedor responde `{"serie":[{"fecha":"2026-03-01","valor":39796.31}]}` para 01-03-2026
- **THEN** el valor obtenido es el `Decimal` 39796.31 con `fecha_valor` 2026-03-01

#### Scenario: Serie vacía
- **WHEN** el proveedor responde `{"serie":[]}` (por ejemplo 01-01-2030)
- **THEN** el resultado es «sin datos» y no se persiste nada

#### Scenario: Fecha distinta de la solicitada
- **WHEN** `serie[0].fecha` no coincide con la fecha solicitada
- **THEN** la respuesta se rechaza como inválida y no se usa

#### Scenario: Valor inválido
- **WHEN** `valor` es 0, negativo, no numérico, nulo, no finito, tiene más de 2 decimales o excede `NUMERIC(12,2)`
- **THEN** la respuesta se rechaza como inválida

#### Scenario: Error HTTP, timeout o cuerpo no JSON
- **WHEN** el proveedor responde 4xx/5xx, no responde en 5 segundos, o devuelve un cuerpo que no es JSON válido
- **THEN** el resultado es «no disponible» y no se persiste nada

### Requirement: Valor de la UF por período con referencia en el día 1
El sistema SHALL asociar a cada período mensual (`YYYY-MM`) el valor de la UF del día 1 de ese mes y SHALL persistirlo en `valor_uf_periodo` con `periodo` (día 1, PK), `valor_clp` (`NUMERIC(12,2)`, `> 0`), `fecha_valor`, `fuente` y `obtenido_en`. El día de referencia SHALL definirse en un único punto configurable del código.

#### Scenario: Primera consulta de un período
- **WHEN** se necesita la UF del período 2026-03 y la tabla no tiene fila para él
- **THEN** se consulta el proveedor con la fecha 2026-03-01 y se persiste una fila con `fecha_valor` 2026-03-01, la fuente y el instante de obtención

#### Scenario: Período ya almacenado
- **WHEN** se necesita la UF de un período con fila en `valor_uf_periodo`
- **THEN** se usa el valor almacenado y no se consulta al proveedor

### Requirement: Un valor almacenado no se sobrescribe
El sistema SHALL persistir cada valor de forma idempotente (inserción que ignora conflictos de PK) y SHALL devolver siempre el valor que quedó almacenado. SHALL NOT actualizar ni reemplazar una fila existente, incluso si el proveedor devuelve un valor distinto o si dos consultas concurrentes obtienen el mismo período.

#### Scenario: El proveedor cambia después de almacenar
- **WHEN** un período ya almacenado se consulta de nuevo y el proveedor devolvería otro valor
- **THEN** se devuelve el valor original y la fila no cambia

#### Scenario: Consultas concurrentes del mismo período
- **WHEN** dos solicitudes piden a la vez un período no almacenado
- **THEN** queda una sola fila y ambas reciben el mismo valor, sin error de clave duplicada

#### Scenario: Estabilidad del histórico
- **WHEN** un mes anterior se consulta dos veces sin modificar sus datos
- **THEN** ambas respuestas contienen las mismas cifras y la misma fecha de referencia de la UF

### Requirement: Sin estimación ni sustitución de períodos
Si no hay valor almacenado y el proveedor no entrega un dato válido, el sistema SHALL informar que la UF no está disponible. SHALL NOT estimar, interpolar, redondear hacia otra fecha, arrastrar el valor de otro período ni persistir un valor no obtenido del proveedor.

#### Scenario: Período sin datos en el proveedor
- **WHEN** el proveedor devuelve serie vacía para el período
- **THEN** el servicio informa no disponible aunque exista la UF del mes anterior

#### Scenario: Proveedor caído sin valor almacenado
- **WHEN** el proveedor falla y el período no tiene fila
- **THEN** el servicio informa no disponible y la tabla queda sin cambios

#### Scenario: Proveedor caído con valor almacenado
- **WHEN** el período ya tiene fila y el proveedor está caído
- **THEN** se usa el valor almacenado y no se consulta al proveedor

### Requirement: Degradación a null de todos los equivalentes
Cuando la UF no esté disponible para el período requerido, todo equivalente en CLP previsto en T10 SHALL ser `null` y la operación SHALL completarse con normalidad, sin responder 503 ni error. T10 SHALL NOT introducir un error de dependencia externa porque ningún resultado principal depende de la UF. Para futuras operaciones cuyo resultado principal dependa de la UF, el criterio AC4 aplica: SHALL fallar como dependencia externa (HTTP 503 con mensaje explícito) en lugar de devolver una cifra inventada.

#### Scenario: Equivalente opcional sin UF
- **WHEN** se consulta un crédito y la UF del período no está disponible
- **THEN** la respuesta es 200 con los importes en UF y el equivalente en `null`

#### Scenario: Sin error 503 en las consultas de T10
- **WHEN** el proveedor falla o devuelve serie vacía durante cualquier consulta de crédito, registro mensual o dashboard
- **THEN** ninguna respuesta es 503 y los equivalentes afectados son `null`

### Requirement: Conversión en el backend con Decimal
Todo equivalente en CLP SHALL calcularse en el backend con `convertirUfAClp` sobre `Prisma.Decimal`, sin `Number`, y SHALL entregarse como texto decimal sin redondear. El redondeo SHALL aplicarse solo al presentar. El equivalente SHALL NOT persistirse.

#### Scenario: Conversión exacta
- **WHEN** se convierte 25.4321 UF con una UF de 39796.31 (`Decimal` obtenido del número JSON del proveedor)
- **THEN** el resultado es el producto exacto en texto decimal, sin error de coma flotante

#### Scenario: Equivalente no persistido
- **WHEN** se muestran equivalentes en CLP
- **THEN** ninguna tabla guarda el resultado de la conversión; solo `valor_uf_periodo` guarda el valor de la UF

### Requirement: Tabla de UF con restricciones de integridad
`valor_uf_periodo` SHALL rechazar a nivel de base de datos un `valor_clp` ≤ 0 y un `periodo` que no sea día 1.

#### Scenario: Valor no positivo
- **WHEN** se intenta insertar `valor_clp` 0
- **THEN** la base de datos rechaza la fila

#### Scenario: Período que no es día 1
- **WHEN** se intenta insertar `periodo` 2026-03-15
- **THEN** la base de datos rechaza la fila
