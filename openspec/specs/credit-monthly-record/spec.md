# credit-monthly-record Specification

## Purpose

Esta capability define el registro mensual del crédito hipotecario de una propiedad en RealtyTrack (T03): alta, actualización por período y consulta del dividendo efectivamente pagado (CLP) y del saldo pendiente informado por el banco (UF), con historial por período, mes sin registro explícito y «Último saldo registrado», sin amortización ni cálculo de saldos, sin movimientos financieros y sin conversión a CLP (T10).

## Requirements

### Requirement: Alta del registro mensual
El sistema SHALL registrar, para el crédito de una propiedad existente, una fila por mensualidad con `periodo` (`YYYY-MM`), `dividendoPagadoClp`, `fechaPagoDividendo` y `saldoPendienteUf`. Cada fila SHALL contener al menos un saldo o un dividendo. Un crédito SHALL tener como máximo un registro por período. Los períodos pueden registrarse en cualquier orden, incluidos meses anteriores a registros ya existentes y períodos futuros.

#### Scenario: Alta con dividendo y saldo
- **WHEN** un usuario autenticado envía un período, un dividendo en CLP con su fecha de pago y un saldo en UF para una propiedad con crédito
- **THEN** el sistema responde 201 y ambos quedan asociados a ese período

#### Scenario: Alta solo con saldo
- **WHEN** se envía un período con saldo y sin dividendo ni fecha de pago
- **THEN** el sistema responde 201 con dividendo y fecha de pago en `null`

#### Scenario: Alta solo con dividendo
- **WHEN** se envía un período con dividendo y fecha de pago y sin saldo
- **THEN** el sistema responde 201 con el saldo en `null`

#### Scenario: Fila sin saldo ni dividendo
- **WHEN** se envía un período sin saldo ni dividendo
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Período duplicado
- **WHEN** se hace POST para un período que ya tiene registro en ese crédito
- **THEN** el sistema responde 409 y no modifica el registro existente

#### Scenario: Meses en cualquier orden
- **WHEN** se registra marzo de 2026 y después enero de 2026
- **THEN** ambos se aceptan y el historial los devuelve ordenados por período

#### Scenario: Período futuro
- **WHEN** se registra un período posterior al mes en curso
- **THEN** el sistema lo acepta, porque el modelo no define una restricción

#### Scenario: Propiedad sin crédito o inexistente
- **WHEN** se hace POST para una propiedad que no existe, cuyo id no es UUID, o que no tiene crédito
- **THEN** el sistema responde 404 y no crea ningún registro

### Requirement: Regla de la fecha de pago del dividendo
El sistema SHALL exigir `fechaPagoDividendo` cuando hay `dividendoPagadoClp`, y SHALL exigir que `fechaPagoDividendo` sea `null` cuando no hay dividendo. La regla SHALL aplicarse en la validación de entrada y en un CHECK de PostgreSQL. `periodo` y `fechaPagoDividendo` SHALL conservarse como datos distintos, sin que uno sustituya al otro ni se valide contra el otro.

#### Scenario: Dividendo sin fecha de pago
- **WHEN** se envía un dividendo sin `fechaPagoDividendo`
- **THEN** el sistema responde 400 indicando el campo `fechaPagoDividendo`

#### Scenario: Fecha de pago sin dividendo
- **WHEN** se envía `fechaPagoDividendo` sin dividendo
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Base de datos como red de seguridad
- **WHEN** una escritura directa en la tabla viola la regla de la fecha de pago o deja saldo y dividendo en `null`
- **THEN** PostgreSQL rechaza la fila mediante un CHECK

#### Scenario: Mensualidad y fecha de caja distintas
- **WHEN** se registra el dividendo de la mensualidad de marzo con fecha de pago del 3 de abril
- **THEN** el registro conserva `periodo` de marzo y `fechaPagoDividendo` del 3 de abril, sin ajustar ninguno

### Requirement: Actualización de un registro existente
El sistema SHALL permitir actualizar, con cuerpo completo, únicamente el registro existente del período indicado en la URL. Los campos omitidos SHALL quedar en `null` y el resultado SHALL cumplir las mismas reglas del alta. El período no SHALL poder modificarse. El sistema SHALL NOT crear registros mediante PUT.

#### Scenario: Actualización válida
- **WHEN** se hace PUT con datos válidos para un período que ya tiene registro
- **THEN** el sistema responde 200 con el registro actualizado y no modifica los demás períodos

#### Scenario: PUT sobre período sin registro
- **WHEN** se hace PUT para un período sin registro en un crédito existente
- **THEN** el sistema responde 404 y no crea ningún registro

#### Scenario: PUT sobre propiedad sin crédito o inexistente
- **WHEN** se hace PUT para una propiedad que no existe o que no tiene crédito
- **THEN** el sistema responde 404

#### Scenario: PUT que deja la fila vacía
- **WHEN** se hace PUT sin saldo ni dividendo
- **THEN** el sistema responde 400 y el registro existente no cambia

### Requirement: Consulta del historial mensual
El sistema SHALL devolver el historial del crédito ordenado del período más reciente al más antiguo, sin paginación. Cada elemento SHALL traer `periodo` (`YYYY-MM`), `registrado`, dividendo y saldo como texto decimal sin pérdida de precisión, y fecha de pago como `YYYY-MM-DD`.

#### Scenario: Historial con varios meses
- **WHEN** se consulta el historial de un crédito con registros de enero, marzo y febrero
- **THEN** el sistema responde 200 con marzo, febrero y enero, en ese orden

#### Scenario: Crédito sin registros
- **WHEN** se consulta el historial de un crédito sin registros
- **THEN** el sistema responde 200 con una lista vacía

#### Scenario: Propiedad sin crédito o inexistente
- **WHEN** se consulta el historial de una propiedad que no existe, con id no UUID, o sin crédito
- **THEN** el sistema responde 404

### Requirement: Consulta de un mes anterior
El sistema SHALL devolver para un período el dividendo y el saldo registrados para ese período, nunca los del mes en curso ni los de otro mes.

#### Scenario: Mes anterior con registro
- **WHEN** existen registros de enero y de febrero y se consulta enero
- **THEN** el sistema devuelve el dividendo y el saldo de enero, con `registrado: true`

#### Scenario: Período inválido
- **WHEN** el período de la URL no es `YYYY-MM` o es un mes inexistente como `2026-13`
- **THEN** el sistema responde 400

### Requirement: Mes sin registro
El sistema SHALL responder un mes sin registro con `registrado: false` y dividendo, fecha de pago y saldo en `null`, sin estimar ni arrastrar valores de otro mes. La interfaz SHALL mostrar «No registrado».

#### Scenario: Consulta de un mes sin registro
- **WHEN** se consulta un período válido sin registro en un crédito existente
- **THEN** el sistema responde 200 con `registrado: false` y los tres valores en `null`

#### Scenario: Sin arrastre del mes anterior
- **WHEN** existe saldo en enero y se consulta febrero sin registro
- **THEN** febrero devuelve `registrado: false` y el saldo no se copia ni proyecta desde enero

#### Scenario: Interfaz de un mes sin registro
- **WHEN** la interfaz muestra un mes sin registro
- **THEN** el dividendo y el saldo aparecen como «No registrado»

### Requirement: Último saldo registrado
El sistema SHALL determinar el último saldo registrado como el del registro de período máximo cuyo `saldoPendienteUf` no es nulo, y SHALL entregarlo junto con su período. Un registro solo con dividendo no SHALL desplazar un saldo de un período anterior. El sistema SHALL NOT calcular, estimar ni proyectar saldos, y SHALL NOT amortizar entre meses.

#### Scenario: Último saldo con registros posteriores solo de dividendo
- **WHEN** hay saldo en enero y solo dividendo en febrero
- **THEN** el último saldo registrado es el de enero, con período enero

#### Scenario: Último saldo con períodos futuros
- **WHEN** hay saldo registrado en un período futuro
- **THEN** ese es el de período máximo y se entrega con su período, sin compararlo con la fecha actual

#### Scenario: Sin saldos registrados
- **WHEN** el crédito no tiene ningún registro con saldo
- **THEN** no existe último saldo registrado

### Requirement: Validación de los valores del registro
El sistema SHALL validar la entrada según `docs/data-model.md` §4.4 y responder 400 con errores por campo ante datos inválidos. Los CHECK de PostgreSQL SHALL replicar estas restricciones como red de seguridad. El sistema SHALL NOT aplicar reglas que el modelo no define.

- `periodo`: `YYYY-MM` con mes entre 01 y 12; se guarda como el día 1 del mes.
- `dividendoPagadoClp` (opcional): entero > 0, sin decimales, dentro de `NUMERIC(14,0)`.
- `fechaPagoDividendo`: fecha calendario real `YYYY-MM-DD`; obligatoria si y solo si hay dividendo.
- `saldoPendienteUf` (opcional): ≥ 0, máximo 4 decimales, dentro de `NUMERIC(12,4)`; 0 es válido.

#### Scenario: Dividendo no válido
- **WHEN** el dividendo es 0, negativo o tiene decimales
- **THEN** el sistema responde 400 indicando el campo

#### Scenario: Saldo no válido
- **WHEN** el saldo es negativo, tiene más de 4 decimales o excede el rango
- **THEN** el sistema responde 400

#### Scenario: Cero permitido en el saldo
- **WHEN** el saldo vale 0
- **THEN** el sistema lo acepta

#### Scenario: Fecha inexistente
- **WHEN** `fechaPagoDividendo` es `2026-02-30`
- **THEN** el sistema responde 400

#### Scenario: Período normalizado
- **WHEN** se registra el período `2026-03`
- **THEN** se guarda como `2026-03-01` y se devuelve como `2026-03`

#### Scenario: Sin reglas cruzadas inventadas
- **WHEN** el saldo supera el saldo inicial del crédito, o la fecha de pago es anterior al período
- **THEN** el sistema acepta el registro, porque el modelo no define esas reglas

#### Scenario: Precisión decimal preservada
- **WHEN** se envía `saldoPendienteUf` `"1799.9999"` y dividendo `"412345"`
- **THEN** los valores consultados coinciden exactamente, sin conversión a `Number`

### Requirement: Responsabilidad acotada del registro mensual
El registro mensual SHALL ser el único lugar donde se registra el dividendo hipotecario. El sistema SHALL NOT crear movimientos financieros ni una categoría `DIVIDENDO` a partir de él, SHALL NOT agregar flujos ni calcular flujo neto, y SHALL NOT convertir el saldo a CLP ni persistir equivalentes en CLP. La imputación del egreso al mes de caja por `fechaPagoDividendo` queda para T09.

#### Scenario: Registro sin efectos financieros adicionales
- **WHEN** se registra un dividendo
- **THEN** no se crea ningún movimiento financiero y solo cambia `credito_registro_mensual`

#### Scenario: Sin equivalente en CLP del saldo
- **WHEN** se muestra un saldo en la interfaz
- **THEN** aparece en UF con «CLP: No disponible» y no se persiste ningún equivalente en CLP

### Requirement: Acceso protegido y sin eliminación
Todos los endpoints del registro mensual SHALL exigir sesión y no SHALL exponer eliminación.

#### Scenario: Sin sesión
- **WHEN** se llama a cualquier método de `/api/propiedades/[id]/credito/registro-mensual` sin sesión
- **THEN** el sistema responde 401 JSON

#### Scenario: DELETE no soportado
- **WHEN** se envía DELETE a la colección o a un período
- **THEN** el sistema responde 405

### Requirement: Pruebas de integración aisladas
Las pruebas de integración SHALL ejecutarse solo contra la base indicada en `TEST_DATABASE_URL`. Antes de cualquier escritura, SHALL verificarse que esa URL existe y es distinta de `DATABASE_URL` y de `DIRECT_URL`; si el aislamiento no puede verificarse, las pruebas SHALL omitirse o detenerse sin escribir. Las pruebas SHALL NOT modificar credenciales, usuarios, configuración ni bases de datos para resolver errores, y SHALL borrar únicamente las filas que ellas mismas crearon.

#### Scenario: Aislamiento verificado
- **WHEN** `TEST_DATABASE_URL` está definida y es distinta de `DATABASE_URL` y `DIRECT_URL`
- **THEN** las pruebas de integración se ejecutan y limpian solo sus propias filas

#### Scenario: Aislamiento no verificable
- **WHEN** `TEST_DATABASE_URL` no está definida, o coincide con `DATABASE_URL` o `DIRECT_URL`
- **THEN** las pruebas de integración no escriben nada y se omiten con el motivo

#### Scenario: Error de conexión o permisos
- **WHEN** una prueba de integración falla por conexión o permisos
- **THEN** se informa el error y no se altera ninguna credencial ni configuración de base de datos
