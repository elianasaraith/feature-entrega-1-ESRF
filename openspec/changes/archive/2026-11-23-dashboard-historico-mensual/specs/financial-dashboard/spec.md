## ADDED Requirements

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
