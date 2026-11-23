# financial-dashboard Specification

## Purpose

Consultar el flujo financiero mensual de la cartera y de cada propiedad —ingresos, dividendos, otros egresos, flujo neto, estado de pagos del mes contractual y saldo de créditos en UF— calculado al consultar por regla de caja, sin persistir derivados. El saldo en UF se acompaña de un equivalente en CLP opcional, calculado con el valor de la UF del mes consultado (T10), que es informativo y no modifica ningún total, flujo neto ni estado de pago; si esa UF no está disponible, el equivalente es `null` y se muestra «No disponible».
## Requirements
### Requirement: Totales mensuales por regla de caja
El sistema SHALL calcular, para un mes `YYYY-MM`, los ingresos recibidos como la suma de `abono_arriendo.monto_clp` con `fecha_recepcion` en el mes; los dividendos pagados como la suma de `credito_registro_mensual.dividendo_pagado_clp` con `fecha_pago_dividendo` en el mes; y los otros egresos como la suma de `movimiento_financiero.monto_clp` con `fecha` en el mes. Los egresos totales SHALL ser dividendos más otros egresos, y el flujo neto SHALL ser ingresos menos egresos totales, pudiendo ser negativo. Todos los importes SHALL ser CLP enteros operados sin `Number` (BigInt o Decimal). `periodo` y `pago_esperado.periodo` SHALL NOT intervenir en estos totales. No SHALL persistirse ningún total derivado.

#### Scenario: Flujo neto negativo
- **WHEN** un mes tiene 500.000 de ingresos y 650.000 de egresos
- **THEN** el flujo neto es −150.000

#### Scenario: Abono cobrado en mes distinto al contractual
- **WHEN** el pago esperado de marzo recibe un abono con `fecha_recepcion` en abril
- **THEN** el abono suma a los ingresos de abril y no a los de marzo

#### Scenario: Dividendo pagado en mes distinto al período
- **WHEN** el registro con `periodo` marzo tiene `fecha_pago_dividendo` en abril
- **THEN** el dividendo suma a los dividendos de abril y no a los de marzo

#### Scenario: Registro sin dividendo
- **WHEN** un registro mensual solo tiene saldo y no tiene dividendo ni fecha de pago
- **THEN** no aporta a los dividendos de ningún mes

#### Scenario: Mes sin operaciones
- **WHEN** se consulta un mes sin abonos, dividendos ni movimientos
- **THEN** ingresos, dividendos, otros egresos, egresos totales y flujo neto son 0, sin error

#### Scenario: Mes futuro
- **WHEN** se consulta un mes posterior al actual
- **THEN** la respuesta es válida con los datos existentes de ese mes, normalmente en cero

#### Scenario: Edición o eliminación
- **WHEN** se edita o elimina un abono o un movimiento del mes
- **THEN** la siguiente consulta del mes refleja el cambio

#### Scenario: Sin duplicación
- **WHEN** un mes tiene un dividendo registrado en T03 y movimientos en T07
- **THEN** el dividendo se cuenta una sola vez, solo desde el registro mensual del crédito

### Requirement: Dashboard de cartera
El sistema SHALL ofrecer `GET /api/dashboard?mes=YYYY-MM` y la página `/dashboard` con los totales mensuales de toda la cartera, el estado de pagos esperados del mes, el saldo de créditos en UF con su equivalente opcional en CLP y un resumen por propiedad. El total de cartera SHALL ser igual a la suma de los totales de cada propiedad. Sin `mes`, SHALL usarse el mes de `hoyChile()`. El dashboard SHALL NOT ordenar, puntuar ni comparar propiedades entre sí; el resumen por propiedad SHALL listarse en un orden estable no basado en cifras y enlazar a su detalle. El equivalente en CLP del saldo SHALL NOT alterar ningún total, flujo ni estado de pago.

#### Scenario: Total igual a suma de propiedades
- **WHEN** hay varias propiedades con movimientos en el mes
- **THEN** cada total de cartera iguala la suma del mismo total en las propiedades

#### Scenario: Aislamiento por propiedad
- **WHEN** solo la propiedad A tiene operaciones en el mes
- **THEN** la propiedad B figura con importes en 0 y no se le atribuyen operaciones de A

#### Scenario: Mes por defecto
- **WHEN** se consulta sin `mes`
- **THEN** se usa el mes de `hoyChile()`

#### Scenario: Mes inválido
- **WHEN** `mes` no cumple `YYYY-MM` con mes 01–12
- **THEN** el endpoint responde 400

#### Scenario: Sin sesión
- **WHEN** se llama al endpoint sin sesión
- **THEN** responde 401 y no devuelve datos

#### Scenario: Sin comparación
- **WHEN** se consulta el dashboard
- **THEN** no existe ranking, puntaje ni indicador que ordene propiedades por rendimiento

#### Scenario: Cifras de rentabilidad intactas
- **WHEN** se consulta un mes con y sin UF disponible
- **THEN** ingresos, dividendos, otros egresos, egresos totales, flujo neto y estados de pago son idénticos en ambos casos

### Requirement: Estado de pagos esperados del mes contractual
El sistema SHALL presentar los pagos esperados cuyo `pago_esperado.periodo` es el mes consultado, con monto esperado, recibido, saldo pendiente, estado (`PENDIENTE`, `PARCIALMENTE_PAGADO`, `VENCIDO`, `PAGADO`) y calificaciones, obtenidos con `calcularEstadoPago` y `hoyChile()`, sin recalcular reglas ni persistir estados. Los abonos SHALL contarse en su totalidad para el pago, sin importar su `fecha_recepcion`.

#### Scenario: Estados distintos en el mes
- **WHEN** el mes tiene pagos pendiente, parcial, vencido y pagado
- **THEN** cada uno se presenta con su estado y su saldo pendiente

#### Scenario: Abono posterior al mes
- **WHEN** el pago de marzo se completa con abonos recibidos en abril
- **THEN** en marzo figura como pagado, mientras sus ingresos de caja pertenecen a abril

#### Scenario: Mes sin pagos esperados
- **WHEN** no existen pagos esperados para el mes
- **THEN** la lista de pagos está vacía y no hay error

### Requirement: Saldo de créditos en UF por período
El sistema SHALL presentar, por propiedad con crédito, el saldo en UF del registro con `saldo_pendiente_uf` no nulo y mayor `periodo` menor o igual al mes consultado, indicando el período de ese registro. SHALL NOT usar registros posteriores al mes consultado. Sin registro aplicable o sin crédito, SHALL indicarse "sin saldo registrado" en lugar de 0. El saldo SHALL expresarse en UF con hasta 4 decimales y SHALL acompañarse de un equivalente en CLP calculado en el backend con la UF del mes consultado (`mes`) y de la fecha de referencia de esa UF; el monto en UF SHALL NOT modificarse. Si no existe UF para el mes consultado, el equivalente SHALL ser `null` y la interfaz SHALL mostrar «No disponible». El equivalente SHALL NOT sumarse a ningún total.

#### Scenario: Último registro aplicable
- **WHEN** hay saldos en enero y marzo y se consulta febrero
- **THEN** se usa el saldo de enero en UF y su equivalente en CLP se calcula con la UF de febrero

#### Scenario: Mes futuro
- **WHEN** se consulta un mes posterior al último registro
- **THEN** se usa el último registro existente, se indica su período y el equivalente usa la UF del mes consultado, o es `null` si esa UF no está disponible

#### Scenario: Mes anterior a todo registro
- **WHEN** el mes es anterior al primer registro con saldo
- **THEN** se indica "sin saldo registrado" y no hay equivalente

#### Scenario: UF del mes consultado no disponible
- **WHEN** el registro aplicable existe pero no hay UF para el mes consultado
- **THEN** el saldo aparece en UF, el equivalente es `null`, la interfaz muestra «No disponible» y el resto del dashboard responde con normalidad

#### Scenario: Histórico estable
- **WHEN** el dashboard de un mes anterior se consulta dos veces y la UF actual cambió entre ambas
- **THEN** el equivalente y la fecha de referencia son idénticos en ambas respuestas

### Requirement: Resumen mensual por propiedad
El sistema SHALL ofrecer `GET /api/propiedades/{id}/resumen-mensual?mes=YYYY-MM` con ingresos recibidos, dividendos pagados, otros egresos, flujo neto y actividad reciente de esa propiedad, producidos por el mismo `dashboard-service` que la cartera. Responde 404 si la propiedad no existe o el id no es UUID, 400 con mes inválido y 401 sin sesión.

#### Scenario: Resumen de una propiedad
- **WHEN** se consulta una propiedad con operaciones en el mes
- **THEN** los totales coinciden con su fila en el dashboard de cartera

#### Scenario: Propiedad inexistente
- **WHEN** el id no existe o no es UUID
- **THEN** responde 404

### Requirement: Actividad reciente del mes
El sistema SHALL combinar abonos (por `fecha_recepcion`), dividendos pagados (por `fecha_pago_dividendo`) y movimientos T07 (por `fecha`) del mes y la propiedad en una lista con fecha, concepto, importe en CLP y origen, ordenada de más reciente a más antigua, con desempate determinista. Cada elemento SHALL enlazar al módulo correspondiente cuando exista una ruta.

#### Scenario: Orden descendente
- **WHEN** el mes tiene un abono el día 5, un dividendo el día 10 y un movimiento el día 20
- **THEN** la lista es movimiento, dividendo, abono

#### Scenario: Cada hecho una sola vez
- **WHEN** el mes tiene un abono, un dividendo y un movimiento
- **THEN** la lista contiene exactamente tres elementos, cada uno con su origen

#### Scenario: Mes sin actividad
- **WHEN** no hay hechos en el mes
- **THEN** la lista está vacía

### Requirement: Formato de importes y vigencia de los datos
La interfaz SHALL mostrar CLP con separador de miles y sin decimales, y UF con hasta 4 decimales, formateando desde texto o Decimal sin pasar por `Number`; los cálculos financieros SHALL residir en servicios y funciones de dominio, no en componentes React. Las vistas SHALL reflejar los cambios hechos tras registrar, editar o eliminar abonos, dividendos o movimientos, incluso al volver a ellas, sin recarga manual.

#### Scenario: Formato
- **WHEN** se muestra 1234567 CLP y 1234.5 UF
- **THEN** se ven como `1.234.567` y `1.234,5`

#### Scenario: Vuelta a la vista
- **WHEN** se registra un movimiento y se vuelve al detalle o al dashboard
- **THEN** los totales y la actividad ya lo incluyen

### Requirement: Movimientos desglosados se cuentan una sola vez
El sistema SHALL contabilizar cada movimiento financiero una sola vez en los otros egresos, los egresos totales y el flujo neto, con su `montoClp`, que en un gasto desglosado es la suma de sus conceptos. El dashboard MUST NOT leer ni sumar los conceptos de un movimiento, y MUST NOT cambiar ninguna de sus fórmulas, DTO ni consultas por la existencia del desglose. La actividad reciente SHALL mostrar un solo elemento por movimiento, simple o desglosado.

#### Scenario: Desglosado contado una vez
- **WHEN** el mes tiene un movimiento desglosado de 150.000 (60.000, 70.000 y 20.000)
- **THEN** los otros egresos del mes son 150.000, no 300.000

#### Scenario: Simples y desglosados en el mismo mes
- **WHEN** el mes tiene un gasto simple de 100.000 y un gasto desglosado de 150.000
- **THEN** los otros egresos son 250.000

#### Scenario: Flujo neto con un desglosado
- **WHEN** el mes tiene 500.000 de ingresos y un movimiento desglosado de 650.000
- **THEN** el flujo neto es −150.000

#### Scenario: Cartera igual a la suma de propiedades
- **WHEN** varias propiedades tienen movimientos simples y desglosados en el mes
- **THEN** el total de cartera iguala la suma de los totales por propiedad

#### Scenario: Actividad reciente
- **WHEN** el mes tiene un movimiento desglosado en tres conceptos
- **THEN** la actividad reciente contiene un único elemento de origen movimiento, con el total del movimiento

#### Scenario: Conversión reflejada
- **WHEN** un gasto simple de 100.000 se edita a desglosado con total 150.000
- **THEN** la siguiente consulta del mes cuenta 150.000 y no 100.000 ni 250.000

#### Scenario: Eliminación de un desglosado
- **WHEN** se elimina un movimiento desglosado del mes
- **THEN** la siguiente consulta del mes ya no cuenta su total

