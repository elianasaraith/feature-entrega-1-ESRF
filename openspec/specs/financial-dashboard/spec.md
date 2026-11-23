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

### Requirement: Histórico mensual de totales de cartera
El sistema SHALL ofrecer `GET /api/dashboard/historico?mes=YYYY-MM&meses=N` con los totales de caja de la cartera (`ingresosClp`, `dividendosClp`, `otrosEgresosClp`, `egresosTotalesClp`, `flujoNetoClp`) para cada uno de los `N` meses calendario que terminan en `mes` inclusive, en orden cronológico ascendente, incluso al cruzar un año. `mes` SHALL ser opcional (por defecto el mes de `hoyChile()`); `meses` SHALL ser un entero de 1 a 12 (por defecto 6). Cada período SHALL calcularse con las mismas reglas de caja del dashboard mensual (`abono_arriendo.fecha_recepcion`, `credito_registro_mensual.fecha_pago_dividendo`, `movimiento_financiero.fecha`) y los mismos importes CLP enteros operados sin `Number`. Un mes sin operaciones SHALL aparecer con todos sus importes en 0. El histórico SHALL NOT incluir estados de pago, saldos ni equivalentes en CLP, SHALL NOT consultar la UF ni al proveedor y SHALL NOT persistir ningún derivado. Un gasto desglosado SHALL contarse una sola vez, con su `monto_clp`.

#### Scenario: Seis meses por defecto
- **WHEN** se consulta `?mes=2026-11` sin `meses`
- **THEN** la respuesta contiene 6 períodos, de 2026-06 a 2026-11, en orden ascendente

#### Scenario: Cruce de año
- **WHEN** se consulta `?mes=2026-02&meses=6`
- **THEN** los períodos son 2025-09, 2025-10, 2025-11, 2025-12, 2026-01 y 2026-02

#### Scenario: Doce meses
- **WHEN** se consulta `?meses=12`
- **THEN** la respuesta contiene 12 períodos que terminan en el mes actual de Chile

#### Scenario: Mes sin operaciones dentro de la serie
- **WHEN** un mes intermedio de la serie no tiene abonos, dividendos ni movimientos
- **THEN** ese período figura con ingresos, dividendos, otros egresos, egresos totales y flujo neto en 0

#### Scenario: Consistencia con el dashboard mensual
- **WHEN** se consulta el histórico y luego `GET /api/dashboard?mes=M` para un mes `M` de la serie
- **THEN** los totales del período `M` del histórico son idénticos a `totales` del dashboard de `M`

#### Scenario: Hechos de caja en otro mes que su período
- **WHEN** un abono del período contractual de marzo se recibe en abril
- **THEN** su importe figura en el período abril del histórico y no en marzo

#### Scenario: Gasto desglosado
- **WHEN** un mes tiene un movimiento desglosado de 150.000
- **THEN** sus otros egresos en el histórico son 150.000, no la suma de los conceptos más el total

#### Scenario: Parámetros inválidos
- **WHEN** `mes` no cumple `YYYY-MM` con mes 01–12, o `meses` no es un entero entre 1 y 12
- **THEN** el endpoint responde 400

#### Scenario: Sin sesión
- **WHEN** se llama al endpoint sin sesión
- **THEN** responde 401 y no devuelve datos

#### Scenario: Sin llamadas a la UF
- **WHEN** se consulta el histórico
- **THEN** no se consulta `valor_uf_periodo` ni el proveedor de UF

### Requirement: Saldo hipotecario consolidado de la cartera
`GET /api/dashboard` y la página `/dashboard` SHALL incluir `saldoConsolidado` con: `totalUf` (suma exacta, en `Decimal`, de los saldos en UF aplicables de cada crédito según la regla "Saldo de créditos en UF por período"), `creditos` (`total`, `conSaldo`, `sinSaldo`), `estado` y `equivalenteClp`. El crédito sin saldo aplicable SHALL contarse en `sinSaldo` y SHALL NOT aportar 0 al total. `estado` SHALL ser `COMPLETO` si todos los créditos tienen saldo aplicable (y existe al menos uno), `PARCIAL` si solo algunos lo tienen y `SIN_SALDOS` si ninguno lo tiene o no hay créditos; con `SIN_SALDOS`, `totalUf` y `equivalenteClp` SHALL ser `null`. `equivalenteClp` SHALL obtenerse convirtiendo `totalUf` con la UF del mes consultado (un único período por solicitud), con el mismo cálculo y forma que el equivalente por propiedad, y SHALL ser `null` si esa UF no está disponible. El consolidado SHALL expresarse solo en UF y en el equivalente de ese total; SHALL NOT sumar importes de monedas distintas ni obtenerse sumando equivalentes en CLP individuales. SHALL NOT alterar ningún total de flujo, flujo neto ni estado de pago. La respuesta SHALL conservar todos los campos existentes sin cambios.

#### Scenario: Varios créditos con saldo
- **WHEN** hay tres créditos con saldos aplicables de 100, 250,5 y 50,25 UF
- **THEN** `totalUf` es 400,75 exacto, `estado` es `COMPLETO` y `creditos` es `{ total: 3, conSaldo: 3, sinSaldo: 0 }`

#### Scenario: Cada crédito usa su último saldo aplicable
- **WHEN** un crédito tiene saldos en enero y marzo, otro solo en febrero, y se consulta febrero
- **THEN** el total suma el saldo de enero del primero y el de febrero del segundo, nunca registros posteriores a febrero

#### Scenario: Crédito sin saldo no es cero
- **WHEN** dos créditos tienen saldo y un tercero no tiene registro con saldo hasta el mes consultado
- **THEN** `estado` es `PARCIAL`, `creditos` es `{ total: 3, conSaldo: 2, sinSaldo: 1 }` y `totalUf` suma solo los dos con saldo

#### Scenario: Crédito aún no otorgado
- **WHEN** un crédito tiene `fecha_otorgamiento` posterior al fin del mes consultado y no tiene saldo aplicable
- **THEN** no forma parte del universo (`total`) ni cuenta como `sinSaldo`

#### Scenario: Ningún saldo disponible
- **WHEN** ningún crédito tiene saldo aplicable, o la cartera no tiene créditos
- **THEN** `estado` es `SIN_SALDOS`, `totalUf` y `equivalenteClp` son `null` y no se muestra 0

#### Scenario: Equivalente con la UF del mes consultado
- **WHEN** `totalUf` es 400,75 y la UF del mes consultado es 40.000,00
- **THEN** `equivalenteClp.valorClp` es el producto exacto, con `ufClp` y `fechaReferencia` de esa UF, y el proveedor se consulta como máximo una vez

#### Scenario: UF del mes no disponible
- **WHEN** hay saldos pero no existe UF para el mes consultado
- **THEN** `totalUf` y `estado` se informan, `equivalenteClp` es `null`, la respuesta es 200 y el resto del dashboard es idéntico al caso con UF

#### Scenario: Precisión Decimal
- **WHEN** se suman saldos con 4 decimales
- **THEN** el resultado no presenta errores de coma flotante

#### Scenario: Compatibilidad del contrato existente
- **WHEN** un cliente existente consume `GET /api/dashboard`
- **THEN** `mes`, `totales` y `propiedades` (con `saldoCredito` y `pagos`) conservan nombres, tipos y valores; `saldoConsolidado` es el único campo añadido

#### Scenario: No altera los flujos
- **WHEN** se consulta un mes con y sin UF disponible
- **THEN** ingresos, dividendos, otros egresos, egresos totales, flujo neto y estados de pago son idénticos

### Requirement: Navegación entre meses e histórico en el dashboard
La página `/dashboard` SHALL mostrar el histórico de 6 meses como una tabla simple (mes, ingresos, dividendos, otros egresos, egresos totales, flujo neto), con un enlace para ver 12 meses, y SHALL ofrecer enlaces al mes anterior y al mes siguiente del mes consultado que conserven el selector de mes existente. El mes anterior de enero SHALL ser diciembre del año previo y el siguiente de diciembre SHALL ser enero del año siguiente. Los componentes SHALL solo presentar cifras ya calculadas por el servicio, con el formato de importes vigente y sin cálculo financiero en React. Un consolidado `PARCIAL` SHALL indicarse como parcial con el número de créditos sin saldo, y `SIN_SALDOS` SHALL mostrarse como «Sin saldo registrado», nunca como 0. Un equivalente `null` SHALL mostrarse como «No disponible».

#### Scenario: Mes anterior en enero
- **WHEN** se consulta enero de 2026 en el dashboard
- **THEN** el enlace "mes anterior" apunta a `?mes=2025-12`

#### Scenario: Mes siguiente en diciembre
- **WHEN** se consulta diciembre de 2026
- **THEN** el enlace "mes siguiente" apunta a `?mes=2027-01`

#### Scenario: Selector vigente
- **WHEN** el usuario elige un mes con el selector existente
- **THEN** el dashboard, el histórico y el consolidado se recalculan para ese mes

#### Scenario: Consolidado parcial visible
- **WHEN** el consolidado es `PARCIAL` con un crédito sin saldo
- **THEN** la página indica que el total es parcial y cuántos créditos no tienen saldo

#### Scenario: Doce meses
- **WHEN** el usuario elige ver 12 meses
- **THEN** la tabla muestra 12 filas y el resto del dashboard no cambia

