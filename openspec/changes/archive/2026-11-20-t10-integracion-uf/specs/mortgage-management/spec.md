## RENAMED Requirements

- FROM: `### Requirement: La UF es el dato principal y el equivalente en CLP no está disponible hasta T10`
- TO: `### Requirement: La UF es el dato principal y el equivalente en CLP es opcional`

## MODIFIED Requirements

### Requirement: La UF es el dato principal y el equivalente en CLP es opcional
La interfaz SHALL mostrar la cuota contractual, el saldo inicial y el «Último saldo registrado» en UF como dato principal. El equivalente en CLP SHALL calcularse en el backend con el valor de la UF de `valor_uf_periodo` y SHALL mostrarse junto a la UF, sin reemplazarla ni modificar el monto original. La referencia temporal SHALL ser: para la cuota contractual, el mes actual (`hoyChile()`); para el saldo inicial, el mes de `fechaOtorgamiento` (único campo de fecha del crédito); para el último saldo registrado, el período de su registro. Si `fechaOtorgamiento` es `null`, el equivalente del saldo inicial SHALL ser `null` y la interfaz SHALL indicar la limitación («Sin fecha de otorgamiento»), sin inventar otra referencia. Cuando no exista UF para el período requerido, el equivalente SHALL ser `null` y la interfaz SHALL mostrar «No disponible». La interfaz SHALL mostrar la fecha de referencia de la UF usada. El sistema SHALL NOT persistir equivalentes en CLP, estimar la UF ni usar el valor de otro período. La página del crédito SHALL además mostrar el «Último saldo registrado» en UF con su período, tomado del registro mensual de período máximo con saldo no nulo, diferenciado del saldo inicial, o «No registrado» si no existe; SHALL NOT rotularlo «Saldo actual» ni calcular o proyectar saldos. La consulta del crédito SHALL conservar sus campos actuales y SHALL añadir los equivalentes en CLP y la UF usada como campos opcionales.

#### Scenario: Cuota con UF del mes actual
- **WHEN** se muestra un crédito y existe la UF del mes actual
- **THEN** la cuota contractual aparece en UF con su equivalente en CLP, y la UF utilizada y su fecha de referencia se presentan en la sección centralizada «Valores de UF utilizados» (una sola vez por referencia distinta)

#### Scenario: Saldo inicial con UF del mes de otorgamiento
- **WHEN** el crédito tiene `fechaOtorgamiento` en marzo de 2024 y saldo inicial, y existe la UF de marzo de 2024
- **THEN** el saldo inicial aparece en UF con su equivalente en CLP calculado con la UF del 1 de marzo de 2024, y esa referencia consta en la sección «Valores de UF utilizados»

#### Scenario: Saldo inicial sin fecha de otorgamiento
- **WHEN** el crédito tiene saldo inicial pero `fechaOtorgamiento` es `null`
- **THEN** el equivalente del saldo inicial es `null`, la interfaz indica «Sin fecha de otorgamiento» y no se usa el mes actual ni otro mes como sustituto

#### Scenario: Visualización sin UF
- **WHEN** no existe UF para el período requerido y el proveedor no aporta dato
- **THEN** la respuesta es 200, los importes en UF se muestran y el equivalente en CLP aparece como «No disponible»

#### Scenario: Último saldo registrado distinto del saldo inicial
- **WHEN** un crédito con saldo inicial tiene un saldo mensual registrado
- **THEN** la página muestra ambos por separado: «Saldo inicial» y «Último saldo registrado» con su período, este último con su equivalente en CLP calculado con la UF de ese período o «No disponible»

#### Scenario: Sin saldo mensual registrado
- **WHEN** el crédito no tiene ningún registro mensual con saldo
- **THEN** «Último saldo registrado» aparece como «No registrado»

#### Scenario: Compatibilidad de la consulta
- **WHEN** se consulta el crédito con la UF no disponible
- **THEN** todos los campos previos de la respuesta se mantienen iguales, los montos en UF no cambian y los campos de equivalente son `null`
