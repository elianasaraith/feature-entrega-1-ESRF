## MODIFIED Requirements

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
