# financial-movements Specification

## Purpose

TBD - created by archiving change t07-movimientos-financieros. Update Purpose after archive.

## Requirements

### Requirement: Registro de movimiento financiero
El sistema SHALL permitir registrar, para una propiedad existente, un movimiento financiero (egreso manual) con `fecha`, `categoria`, `montoClp` (entero > 0) y `descripcion` opcional, mediante `POST /api/propiedades/{id}/movimientos`. La `categoria` SHALL ser uno de `REPARACION`, `EQUIPAMIENTO`, `SEGURO`, `CONTRIBUCIONES`, `GASTO_COMUN`, `GASTO_EXTRAORDINARIO` u `OTRO`. El monto SHALL expresarse siempre en CLP.

#### Scenario: Movimiento válido
- **WHEN** un usuario autenticado registra un movimiento con categoría válida, monto positivo y fecha no futura
- **THEN** el sistema responde 201 con el movimiento creado

#### Scenario: Descripción opcional
- **WHEN** se registra un movimiento sin descripción o con descripción vacía
- **THEN** el sistema lo acepta y la descripción consta como ausente

#### Scenario: Monto menor o igual a cero
- **WHEN** se envía un movimiento con `montoClp` igual a 0 o negativo
- **THEN** el sistema responde 422 y no crea el movimiento

#### Scenario: Fecha futura
- **WHEN** se envía un movimiento con `fecha` posterior a la fecha de hoy en Chile
- **THEN** el sistema responde 422 y no crea el movimiento

#### Scenario: Fecha de hoy
- **WHEN** se envía un movimiento con `fecha` igual a la fecha de hoy en Chile
- **THEN** el sistema lo acepta

#### Scenario: Entrada mal formada
- **WHEN** se envía un movimiento con monto no entero, fecha con formato o calendario inválido, o categoría fuera del conjunto permitido
- **THEN** el sistema responde 400 con el error en el campo correspondiente y no crea el movimiento

#### Scenario: Propiedad inexistente
- **WHEN** se registra un movimiento sobre una propiedad que no existe o cuyo id no es un UUID
- **THEN** el sistema responde 404

### Requirement: Solo egresos manuales, sin duplicar otros módulos
El sistema MUST NOT aceptar la categoría `DIVIDENDO` ni modelar un tipo ingreso/egreso en un movimiento financiero. Los dividendos hipotecarios SHALL registrarse únicamente en el registro mensual del crédito, y los ingresos de arriendo únicamente como abonos de pagos esperados.

#### Scenario: Categoría DIVIDENDO rechazada
- **WHEN** se envía un movimiento con `categoria` igual a `DIVIDENDO`
- **THEN** el sistema responde 400 y no crea el movimiento

#### Scenario: Sin campo de tipo
- **WHEN** se envía un movimiento con un campo `tipo` adicional
- **THEN** el sistema ignora el campo y el movimiento persistido es siempre un egreso, sin atributo `tipo`

#### Scenario: Dividendo y movimiento no se duplican
- **WHEN** una propiedad tiene un dividendo registrado en un mes y un movimiento financiero en el mismo mes
- **THEN** el listado y la agregación de movimientos incluyen solo el movimiento, y el dividendo permanece únicamente en el registro mensual del crédito

### Requirement: Gastos comunes durante la vacancia
El sistema SHALL permitir registrar la categoría `GASTO_COMUN` como egreso de una propiedad, incluso en un mes sin contrato de arriendo vigente, sin exigir ni crear contrato, arrendatario ni pago esperado.

#### Scenario: Gasto común en mes de vacancia
- **WHEN** se registra un movimiento `GASTO_COMUN` con fecha en un mes sin contrato vigente de la propiedad
- **THEN** el sistema responde 201 y el movimiento figura como egreso de esa propiedad en ese mes

### Requirement: Consulta de movimientos
El sistema SHALL listar los movimientos de una propiedad mediante `GET /api/propiedades/{id}/movimientos`, ordenados por `fecha` descendente. El listado SHALL admitir el filtro opcional `mes` con formato `YYYY-MM`, que limita el resultado a los movimientos cuya `fecha` cae en ese mes calendario. La respuesta SHALL incluir el total en CLP y el desglose por categoría del conjunto listado.

#### Scenario: Listado sin filtro
- **WHEN** se consulta el listado sin `mes`
- **THEN** el sistema devuelve todos los movimientos de la propiedad, del más reciente al más antiguo

#### Scenario: Filtro por mes
- **WHEN** se consulta el listado con `mes=2026-03`
- **THEN** el sistema devuelve solo movimientos con fecha entre 2026-03-01 y 2026-03-31, incluidos ambos extremos

#### Scenario: Mes mal formado
- **WHEN** se consulta el listado con `mes=2026-13` o `mes=marzo`
- **THEN** el sistema responde 400

#### Scenario: Aislamiento por propiedad
- **WHEN** existen movimientos de dos propiedades y se consulta el listado de una
- **THEN** el sistema devuelve solo los movimientos de esa propiedad

#### Scenario: Consulta de un movimiento
- **WHEN** se consulta `GET /api/propiedades/{id}/movimientos/{movId}` de un movimiento que pertenece a la propiedad
- **THEN** el sistema responde 200 con el movimiento

### Requirement: Edición de movimiento financiero
El sistema SHALL permitir editar `fecha`, `categoria`, `montoClp` y `descripcion` de un movimiento mediante `PUT /api/propiedades/{id}/movimientos/{movId}` con cuerpo completo, aplicando las mismas validaciones que el alta. El movimiento SHALL conservar su propiedad.

#### Scenario: Edición válida
- **WHEN** un usuario autenticado envía un cuerpo válido para un movimiento existente de la propiedad
- **THEN** el sistema responde 200 con el movimiento actualizado

#### Scenario: Edición con datos inválidos
- **WHEN** la edición trae monto ≤ 0 o fecha futura
- **THEN** el sistema responde 422 y el movimiento no cambia

#### Scenario: Movimiento de otra propiedad
- **WHEN** se edita, consulta o elimina un movimiento usando el id de una propiedad a la que no pertenece, o un `movId` inexistente o no UUID
- **THEN** el sistema responde 404 y no modifica ningún dato

### Requirement: Eliminación de movimiento financiero
El sistema SHALL eliminar físicamente un movimiento mediante `DELETE /api/propiedades/{id}/movimientos/{movId}`, sin auditoría. La interfaz SHALL pedir confirmación explícita antes de enviar la eliminación.

#### Scenario: Eliminación válida
- **WHEN** un usuario autenticado elimina un movimiento de la propiedad
- **THEN** el sistema responde 204 y el movimiento deja de aparecer en el listado

#### Scenario: Confirmación en la interfaz
- **WHEN** el usuario pulsa eliminar en la interfaz y cancela la confirmación
- **THEN** no se envía ninguna petición y el movimiento permanece

### Requirement: Agregación mensual por categoría
El sistema SHALL proveer una función de dominio pura que, dada una lista de movimientos, devuelva el total en CLP y el subtotal de cada una de las 7 categorías, incluyendo las categorías sin movimientos con valor `"0"`. La función MUST NOT leer el reloj ni la base de datos, MUST operar con aritmética entera (sin punto flotante) y los montos SHALL viajar como texto. El servicio SHALL exponer el resumen de un mes para una propiedad, imputando cada movimiento al mes de su `fecha`, de modo que T09 lo reutilice sin recalcular.

#### Scenario: Desglose por categoría
- **WHEN** se agregan movimientos de varias categorías
- **THEN** cada subtotal suma solo los movimientos de su categoría y el total es la suma de los siete subtotales

#### Scenario: Categorías vacías
- **WHEN** se agrega una lista vacía o sin movimientos de alguna categoría
- **THEN** el total es `"0"` y toda categoría sin movimientos figura con `"0"`

#### Scenario: Montos grandes sin pérdida de precisión
- **WHEN** la suma supera el rango seguro de enteros de punto flotante
- **THEN** el total es exacto

#### Scenario: Imputación al mes de caja
- **WHEN** un movimiento tiene fecha 2026-03-31 y otro 2026-04-01
- **THEN** el resumen de 2026-03 incluye solo el primero y el de 2026-04 solo el segundo

### Requirement: Acceso protegido
Todos los endpoints de movimientos financieros SHALL exigir una sesión autenticada.

#### Scenario: Sin sesión
- **WHEN** se invoca cualquier endpoint de movimientos sin sesión válida
- **THEN** el sistema responde 401 y no ejecuta ninguna operación

### Requirement: Interfaz de movimientos por propiedad
El sistema SHALL ofrecer en `/propiedades/{id}/movimientos` un listado de movimientos con filtro mensual (mes actual de Chile por defecto), el total del mes y el desglose por categoría en CLP, un formulario de alta y edición, y la acción de eliminar con confirmación. La interfaz MUST NOT calcular totales ni desgloses: SHALL mostrar los entregados por el servidor. El detalle de la propiedad SHALL enlazar a esta página.

#### Scenario: Vista mensual
- **WHEN** el usuario abre la página de movimientos de una propiedad
- **THEN** ve los movimientos del mes actual, su total y el desglose por categoría, y puede cambiar el mes

#### Scenario: Errores de validación visibles
- **WHEN** el servidor rechaza un alta o edición
- **THEN** la interfaz muestra el mensaje junto al campo o como error general y conserva lo ingresado

#### Scenario: Acceso desde la propiedad
- **WHEN** el usuario abre el detalle de una propiedad
- **THEN** encuentra un enlace a sus movimientos
