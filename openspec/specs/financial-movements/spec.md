# financial-movements Specification

## Purpose

TBD - created by archiving change t07-movimientos-financieros. Update Purpose after archive.
## Requirements
### Requirement: Registro de movimiento financiero
El sistema SHALL permitir registrar, para una propiedad existente, un movimiento financiero (egreso manual) con `fecha`, `categoria`, `descripcion` opcional y un monto en CLP, mediante `POST /api/propiedades/{id}/movimientos`. El gasto SHALL ser **simple** —`montoClp` (entero > 0) y sin `conceptos`— o **desglosado** —`conceptos` con al menos un elemento y `montoClp` opcional—, según «Movimiento desglosado en conceptos». `conceptos` SHALL ser una lista cuando se envía; `conceptos` nulo SHALL ser un error de formato. Un cuerpo sin `conceptos` SHALL comportarse exactamente como antes de este cambio. La `categoria` SHALL ser uno de `REPARACION`, `EQUIPAMIENTO`, `SEGURO`, `CONTRIBUCIONES`, `GASTO_COMUN`, `GASTO_EXTRAORDINARIO` u `OTRO`. El monto SHALL expresarse siempre en CLP.

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

#### Scenario: Gasto simple sin monto
- **WHEN** se envía un movimiento sin `conceptos` (ausentes o lista vacía) y sin `montoClp`
- **THEN** el sistema responde 400 con el error en `montoClp` y no crea el movimiento

#### Scenario: Conceptos nulos
- **WHEN** se envía un movimiento con `conceptos` igual a `null`
- **THEN** el sistema responde 400 con el error en `conceptos` y no crea el movimiento

#### Scenario: Lista vacía de conceptos en el alta
- **WHEN** se envía un movimiento con `conceptos` igual a lista vacía y `montoClp` positivo
- **THEN** el sistema crea un gasto simple y responde 201 con `conceptos` igual a lista vacía

#### Scenario: Cuerpo anterior sin conceptos
- **WHEN** un cliente envía el cuerpo que usaba antes de este cambio (`fecha`, `categoria`, `montoClp`, `descripcion`)
- **THEN** el sistema crea un gasto simple y responde 201 con `conceptos` igual a lista vacía

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
El sistema SHALL listar los movimientos de una propiedad mediante `GET /api/propiedades/{id}/movimientos`, ordenados por `fecha` descendente. El listado SHALL admitir el filtro opcional `mes` con formato `YYYY-MM`, que limita el resultado a los movimientos cuya `fecha` cae en ese mes calendario. La respuesta SHALL incluir el total en CLP y el desglose por categoría del conjunto listado, calculados con el `montoClp` de cada movimiento, nunca con la suma de sus conceptos. Cada movimiento SHALL incluir `conceptos`: lista ordenada de `{ id, nombre, montoClp, orden }`, vacía para un gasto simple.

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

#### Scenario: Movimiento simple en el listado
- **WHEN** el listado incluye un gasto simple
- **THEN** su `conceptos` es una lista vacía

#### Scenario: Movimiento desglosado en el listado
- **WHEN** el listado incluye un gasto desglosado con conceptos Materiales 60.000, Mano de obra 70.000 y Transporte 20.000
- **THEN** el movimiento trae sus tres conceptos en el orden en que se registraron y su `montoClp` es 150.000

#### Scenario: Los totales del listado no suman conceptos
- **WHEN** el listado incluye un único movimiento desglosado de 150.000
- **THEN** `totalClp` y el subtotal de su categoría son 150.000, no 300.000

### Requirement: Edición de movimiento financiero
El sistema SHALL permitir editar `fecha`, `categoria`, `descripcion`, el monto y los `conceptos` de un movimiento mediante `PUT /api/propiedades/{id}/movimientos/{movId}`, aplicando las mismas validaciones que el alta. El movimiento SHALL conservar su propiedad. El campo `conceptos` SHALL decidir el destino del desglose:
- **Ausente**: en un movimiento simple, `montoClp` es obligatorio y la edición se comporta como antes de este cambio. En un movimiento desglosado, el sistema SHALL actualizar `fecha`, `categoria` y `descripcion`, SHALL conservar todos sus conceptos y su total actual, y SHALL permitir omitir `montoClp`; si `montoClp` está presente y es igual al total actual SHALL aceptarlo, y si es distinto SHALL responder 422 sin modificar nada.
- **Lista vacía**: SHALL convertir explícitamente el movimiento a simple, exigir `montoClp` positivo y eliminar los conceptos anteriores de forma atómica.
- **Nulo**: SHALL responder 400 en `conceptos`.
- **Con uno o más elementos**: SHALL reemplazar el desglose completo, calcular el nuevo total en el backend y validar `montoClp` cuando se envíe.

La edición SHALL ser atómica: o se aplican el movimiento y todos sus conceptos, o no cambia nada. Un 400 o un 422 MUST NOT modificar el movimiento ni sus conceptos.

#### Scenario: Edición válida
- **WHEN** un usuario autenticado envía un cuerpo válido para un movimiento existente de la propiedad
- **THEN** el sistema responde 200 con el movimiento actualizado

#### Scenario: Edición con datos inválidos
- **WHEN** la edición trae monto ≤ 0 o fecha futura
- **THEN** el sistema responde 422 y el movimiento no cambia

#### Scenario: Movimiento de otra propiedad
- **WHEN** se edita, consulta o elimina un movimiento usando el id de una propiedad a la que no pertenece, o un `movId` inexistente o no UUID
- **THEN** el sistema responde 404 y no modifica ningún dato

#### Scenario: Simple con conceptos ausentes
- **WHEN** se edita un gasto simple con un cuerpo sin `conceptos` y con `montoClp` válido
- **THEN** el sistema responde 200 y el movimiento sigue simple con el nuevo monto, como antes de este cambio

#### Scenario: Simple sin conceptos ni monto
- **WHEN** se edita un gasto simple con un cuerpo sin `conceptos` y sin `montoClp`
- **THEN** el sistema responde 400 con el error en `montoClp` y el movimiento no cambia

#### Scenario: Conceptos ausentes protegen el desglose
- **WHEN** se edita un gasto desglosado con un cuerpo sin `conceptos` y sin `montoClp`
- **THEN** el sistema responde 200, actualiza fecha, categoría y descripción, y el movimiento conserva todos sus conceptos y su total

#### Scenario: Conceptos ausentes y monto igual al total
- **WHEN** se edita un gasto desglosado de 150.000 con un cuerpo sin `conceptos` y con `montoClp` 150.000
- **THEN** el sistema responde 200 y conserva los conceptos y el total

#### Scenario: Conceptos ausentes y monto distinto del total
- **WHEN** se edita un gasto desglosado de 150.000 con un cuerpo sin `conceptos` y con `montoClp` 100.000
- **THEN** el sistema responde 422 y el movimiento conserva su fecha, categoría, descripción, total y conceptos

#### Scenario: Cambiar solo la descripción de un desglosado
- **WHEN** un cliente que desconoce los conceptos edita la descripción de un gasto desglosado enviando el `montoClp` que recibió
- **THEN** el sistema responde 200 y no se pierde ningún concepto

#### Scenario: Reemplazo del desglose
- **WHEN** se edita un movimiento desglosado enviando otros conceptos
- **THEN** el sistema responde 200, los conceptos anteriores desaparecen, los nuevos quedan en el orden enviado y `montoClp` es la nueva suma

#### Scenario: Reemplazo con monto discordante
- **WHEN** se edita un desglosado enviando conceptos que suman 150.000 y `montoClp` 140.000
- **THEN** el sistema responde 422 y el movimiento conserva sus conceptos y su total originales

#### Scenario: Lista vacía convierte a simple
- **WHEN** se edita un movimiento desglosado enviando `conceptos` como lista vacía y `montoClp` positivo
- **THEN** el sistema responde 200, el movimiento queda simple con ese monto y sus conceptos anteriores se eliminan

#### Scenario: Lista vacía sin monto
- **WHEN** se edita un movimiento desglosado enviando `conceptos` como lista vacía y sin `montoClp`
- **THEN** el sistema responde 400 con el error en `montoClp` y el movimiento conserva su total y sus conceptos

#### Scenario: Lista vacía con monto no positivo
- **WHEN** se edita un movimiento desglosado enviando `conceptos` como lista vacía y `montoClp` igual a 0 o negativo
- **THEN** el sistema responde 422 y el movimiento conserva su total y sus conceptos

#### Scenario: Conceptos nulos en la edición
- **WHEN** se edita un movimiento desglosado enviando `conceptos` igual a `null`
- **THEN** el sistema responde 400 con el error en `conceptos` y el movimiento conserva su total y sus conceptos

#### Scenario: Edición fallida no deja cambios parciales
- **WHEN** una edición con conceptos es rechazada por una regla de negocio
- **THEN** el movimiento conserva su fecha, monto y conceptos anteriores

### Requirement: Eliminación de movimiento financiero
El sistema SHALL eliminar físicamente un movimiento mediante `DELETE /api/propiedades/{id}/movimientos/{movId}`, sin auditoría. La interfaz SHALL pedir confirmación explícita antes de enviar la eliminación. Eliminar un movimiento desglosado SHALL eliminar también sus conceptos, sin dejar conceptos huérfanos (`ON DELETE CASCADE`).

#### Scenario: Eliminación válida
- **WHEN** un usuario autenticado elimina un movimiento de la propiedad
- **THEN** el sistema responde 204 y el movimiento deja de aparecer en el listado

#### Scenario: Confirmación en la interfaz
- **WHEN** el usuario pulsa eliminar en la interfaz y cancela la confirmación
- **THEN** no se envía ninguna petición y el movimiento permanece

#### Scenario: Eliminación de un movimiento desglosado
- **WHEN** se elimina un movimiento con tres conceptos
- **THEN** el sistema responde 204 y no queda ningún concepto de ese movimiento

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
El sistema SHALL ofrecer en `/propiedades/{id}/movimientos` un listado de movimientos con filtro mensual (mes actual de Chile por defecto), el total del mes y el desglose por categoría en CLP, un formulario de alta y edición, y la acción de eliminar con confirmación. La interfaz MUST NOT calcular los totales ni el desglose por categoría del listado: SHALL mostrar los entregados por el servidor. El formulario SHALL permitir desglosar el gasto en conceptos dinámicos (agregar y quitar filas con nombre y monto) y mostrar el total en vivo; ese total SHALL obtenerse con la función pura de dominio que suma los conceptos, sin reglas financieras propias en el componente. El listado SHALL mostrar los conceptos de cada movimiento desglosado. El detalle de la propiedad SHALL enlazar a esta página.

#### Scenario: Vista mensual
- **WHEN** el usuario abre la página de movimientos de una propiedad
- **THEN** ve los movimientos del mes actual, su total y el desglose por categoría, y puede cambiar el mes

#### Scenario: Errores de validación visibles
- **WHEN** el servidor rechaza un alta o edición
- **THEN** la interfaz muestra el mensaje junto al campo o como error general y conserva lo ingresado

#### Scenario: Acceso desde la propiedad
- **WHEN** el usuario abre el detalle de una propiedad
- **THEN** encuentra un enlace a sus movimientos

#### Scenario: Desglosar un gasto
- **WHEN** el usuario activa «Desglosar en conceptos» y agrega filas con nombre y monto
- **THEN** el formulario muestra el total en vivo como suma de los montos válidos y no pide el monto total aparte

#### Scenario: Conceptos en el listado
- **WHEN** el listado incluye un movimiento desglosado
- **THEN** muestra su total y, bajo él, cada concepto con su nombre y monto

#### Scenario: Pasar de desglosado a simple
- **WHEN** el usuario edita un movimiento desglosado y desactiva el desglose
- **THEN** la interfaz advierte que los conceptos se descartarán, exige el monto total y solo entonces envía `conceptos` como lista vacía

#### Scenario: La interfaz no omite conceptos
- **WHEN** el usuario guarda cualquier movimiento desde el formulario
- **THEN** la petición incluye `conceptos` (con elementos o lista vacía) y nunca lo omite ni lo envía nulo

#### Scenario: Errores de conceptos visibles
- **WHEN** el servidor rechaza un concepto (nombre vacío, monto inválido o suma distinta del total)
- **THEN** la interfaz muestra el mensaje junto a la fila o como error general y conserva lo ingresado

### Requirement: Movimiento desglosado en conceptos
El sistema SHALL permitir que un movimiento financiero se registre desglosado en uno o varios conceptos, cada uno con `nombre` y `montoClp`. El `nombre` SHALL tener entre 1 y 100 caracteres tras eliminar espacios en los extremos y MAY repetirse entre conceptos del mismo movimiento. El `montoClp` de un concepto SHALL ser un entero CLP mayor que 0. Un movimiento SHALL tener como máximo 50 conceptos. Los conceptos SHALL conservar el orden en que se enviaron. Un concepto MUST NOT ser un movimiento independiente: no tiene fecha, categoría ni propiedad propias, y el sistema MUST NOT exponer rutas para crearlos, consultarlos, editarlos o eliminarlos por separado. Un movimiento sin conceptos es un gasto simple y MUST NOT requerir ninguna marca adicional.

#### Scenario: Gasto desglosado válido
- **WHEN** se registra una reparación con conceptos Materiales 60.000, Mano de obra 70.000 y Transporte 20.000
- **THEN** el sistema responde 201 y el movimiento tiene tres conceptos en ese orden y `montoClp` 150.000

#### Scenario: Nombres repetidos
- **WHEN** se registra un movimiento con dos conceptos llamados «Materiales»
- **THEN** el sistema lo acepta y conserva ambos

#### Scenario: Nombre vacío o demasiado largo
- **WHEN** un concepto tiene nombre vacío, solo espacios o más de 100 caracteres
- **THEN** el sistema responde 400 con el error en `conceptos.N.nombre` y no crea el movimiento

#### Scenario: Demasiados conceptos
- **WHEN** se envían más de 50 conceptos
- **THEN** el sistema responde 400 con el error en `conceptos` y no crea el movimiento

#### Scenario: Monto de concepto no entero
- **WHEN** un concepto trae un monto con decimales, texto no numérico o más de 14 dígitos
- **THEN** el sistema responde 400 con el error en `conceptos.N.montoClp` y no crea el movimiento

#### Scenario: Monto de concepto menor o igual a cero
- **WHEN** un concepto trae `montoClp` igual a 0 o negativo
- **THEN** el sistema responde 422 y no crea el movimiento

#### Scenario: Los conceptos no son movimientos
- **WHEN** se registra un movimiento desglosado en tres conceptos
- **THEN** el listado devuelve un único movimiento, no cuatro

### Requirement: Total del movimiento igual a la suma de sus conceptos
En un gasto desglosado, el `montoClp` del movimiento SHALL ser la suma exacta de los `montoClp` de sus conceptos. El sistema SHALL calcular esa suma en el backend con aritmética entera exacta (`bigint`) y guardarla en `movimiento_financiero.monto_clp`. Si `montoClp` se envía junto con conceptos, SHALL coincidir con la suma; de lo contrario el sistema SHALL responder 422 y no guardar nada. Si se omite junto con conceptos, el sistema SHALL usar la suma. Si la suma supera 14 dígitos, el sistema SHALL responder 422. Los conceptos MUST NOT sumarse de nuevo a ningún total, ya que el total del movimiento ya los incluye.

#### Scenario: Total calculado por el servidor
- **WHEN** se registra un movimiento desglosado sin `montoClp`
- **THEN** el movimiento guarda como `montoClp` la suma de sus conceptos

#### Scenario: Total enviado y coincidente
- **WHEN** se envía `montoClp` 150.000 con conceptos que suman 150.000
- **THEN** el sistema lo acepta

#### Scenario: Total enviado y distinto
- **WHEN** se envía `montoClp` 140.000 con conceptos que suman 150.000
- **THEN** el sistema responde 422 y no crea ni modifica el movimiento

#### Scenario: Suma que excede el rango
- **WHEN** los conceptos suman más de 14 dígitos
- **THEN** el sistema responde 422 y no guarda nada

#### Scenario: Suma exacta con montos grandes
- **WHEN** los conceptos suman más que el rango seguro de enteros de punto flotante
- **THEN** el total es exacto

### Requirement: Conversión entre gasto simple y desglosado
El sistema SHALL permitir convertir un movimiento de simple a desglosado y viceversa mediante `PUT /api/propiedades/{id}/movimientos/{movId}`, sin endpoints adicionales. Al convertir a desglosado, enviando `conceptos` con al menos un elemento, el `montoClp` del movimiento SHALL pasar a ser la suma de los conceptos enviados. Al convertir a simple, SHALL enviarse `conceptos` como lista vacía junto con un `montoClp` positivo, y SHALL eliminarse el desglose anterior. Omitir `conceptos` MUST NOT convertir un desglosado a simple. La conversión MUST NOT cambiar la propiedad, el id ni la fecha de creación del movimiento.

#### Scenario: Simple a desglosado
- **WHEN** se edita un gasto simple de 150.000 enviando conceptos que suman 150.000
- **THEN** el movimiento queda desglosado, conserva su id y su total es 150.000

#### Scenario: Simple a desglosado con otro total
- **WHEN** se edita un gasto simple de 100.000 enviando conceptos que suman 150.000 sin `montoClp`
- **THEN** el movimiento queda con total 150.000

#### Scenario: Desglosado a simple solo con lista vacía
- **WHEN** se edita un gasto desglosado enviando `conceptos` como lista vacía y `montoClp` 150.000
- **THEN** el movimiento queda simple con monto 150.000 y sin conceptos

#### Scenario: Omitir conceptos no convierte
- **WHEN** se edita un gasto desglosado con un cuerpo sin `conceptos`
- **THEN** el movimiento sigue desglosado con los mismos conceptos

### Requirement: Atomicidad e integridad del desglose
El alta, la edición y la eliminación de un movimiento con conceptos SHALL ser atómicas: se aplican el movimiento y todos sus conceptos, o ninguno. La base de datos SHALL definir la FK `movimiento_concepto.movimiento_financiero_id` con `ON DELETE CASCADE` y `CHECK (monto_clp > 0)` con `monto_clp` `NUMERIC(14,0)`. El sistema MUST NOT dejar conceptos sin movimiento ni un movimiento desglosado cuyo total difiera de la suma de sus conceptos como resultado de operaciones de la API.

#### Scenario: Rechazo previo sin cambios
- **WHEN** un alta o una edición con conceptos es rechazada por una regla de negocio
- **THEN** no se crea ni se modifica ningún movimiento ni concepto

#### Scenario: Reemplazo completo
- **WHEN** se edita un desglose de tres conceptos enviando dos
- **THEN** el movimiento queda con exactamente esos dos conceptos y ninguno de los anteriores

#### Scenario: Restricción en la base de datos
- **WHEN** se intenta insertar directamente un concepto con `monto_clp` igual a 0 o negativo
- **THEN** la base de datos rechaza la inserción

#### Scenario: Eliminación en cascada
- **WHEN** se elimina directamente un movimiento con conceptos en la base de datos
- **THEN** sus conceptos se eliminan con él

### Requirement: Compatibilidad con movimientos y clientes existentes
Los movimientos existentes SHALL seguir siendo gastos simples, sin conceptos, sin migración de datos ni relleno. Los clientes que usan el cuerpo anterior SHALL seguir funcionando, y la respuesta SHALL añadir `conceptos` como campo aditivo. Un `PUT` sin `conceptos` SHALL conservar el desglose de un movimiento desglosado: un cliente que desconoce los conceptos MUST NOT poder eliminarlos por omisión, y solo `conceptos` como lista vacía SHALL eliminarlos.

#### Scenario: Movimiento existente
- **WHEN** se consulta un movimiento registrado antes de este cambio
- **THEN** responde con `conceptos` lista vacía y su `montoClp` original

#### Scenario: Cliente anterior sobre un simple
- **WHEN** un cliente que no conoce los conceptos crea y edita un movimiento simple con el cuerpo anterior
- **THEN** ambas operaciones tienen el mismo resultado que antes de este cambio

#### Scenario: Cliente anterior sobre un desglosado
- **WHEN** un cliente que no conoce los conceptos edita con el cuerpo anterior un gasto desglosado reenviando su `montoClp` actual
- **THEN** el sistema responde 200 y el movimiento conserva todos sus conceptos

### Requirement: Suma de conceptos como función de dominio pura
El sistema SHALL proveer una función de dominio pura que, dada una lista de montos CLP enteros en texto, devuelva su suma exacta como texto, usando `bigint`, sin leer el reloj ni la base de datos, con lista vacía igual a `"0"`. La misma función SHALL ser la que use el servicio para calcular el total y la que use la interfaz para mostrar el total en vivo.

#### Scenario: Suma de conceptos
- **WHEN** se suman 60.000, 70.000 y 20.000
- **THEN** el resultado es `"150000"`

#### Scenario: Lista vacía
- **WHEN** se suma una lista vacía
- **THEN** el resultado es `"0"`

#### Scenario: Montos grandes
- **WHEN** la suma supera el rango seguro de enteros de punto flotante
- **THEN** el resultado es exacto

