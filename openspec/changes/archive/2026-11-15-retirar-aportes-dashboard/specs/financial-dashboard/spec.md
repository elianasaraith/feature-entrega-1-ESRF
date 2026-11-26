## MODIFIED Requirements

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
El sistema SHALL ofrecer `GET /api/dashboard?mes=YYYY-MM` y la página `/dashboard` con los totales mensuales de toda la cartera, el estado de pagos esperados del mes, el saldo de créditos en UF y un resumen por propiedad. El total de cartera SHALL ser igual a la suma de los totales de cada propiedad. Sin `mes`, SHALL usarse el mes de `hoyChile()`. El dashboard SHALL NOT ordenar, puntuar ni comparar propiedades entre sí; el resumen por propiedad SHALL listarse en un orden estable no basado en cifras y enlazar a su detalle. No SHALL mostrar equivalentes en CLP de saldos UF.

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

#### Scenario: Integración pendiente de T10
- **WHEN** se muestra el dashboard
- **THEN** el equivalente en CLP del saldo UF no aparece como cifra y se indica que queda para T10
