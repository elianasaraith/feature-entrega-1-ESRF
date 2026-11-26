## MODIFIED Requirements

### Requirement: La UF es el dato principal y el equivalente en CLP no está disponible hasta T10
La interfaz SHALL mostrar la cuota y el saldo inicial en UF. El equivalente en CLP SHALL mostrarse como «No disponible» hasta que T10 aporte `valor_uf_periodo`. El sistema SHALL NOT persistir equivalentes en CLP ni usar valores de UF simulados fuera de las pruebas unitarias. La página del crédito SHALL además mostrar el «Último saldo registrado» en UF con su período, tomado del registro mensual de período máximo con saldo no nulo, diferenciado del saldo inicial, o «No registrado» si no existe; SHALL NOT rotularlo «Saldo actual» ni calcular o proyectar saldos.

#### Scenario: Visualización del crédito
- **WHEN** se muestra un crédito con cuota y saldo inicial
- **THEN** ambos aparecen en UF y su equivalente en CLP aparece como «No disponible»

#### Scenario: Criterio pendiente de integración
- **WHEN** se revisa el criterio AC3 (equivalente en CLP con el valor de la UF del período)
- **THEN** consta como pendiente de integración con T10 y no como cumplido

#### Scenario: Último saldo registrado distinto del saldo inicial
- **WHEN** un crédito con saldo inicial tiene un saldo mensual registrado
- **THEN** la página muestra ambos por separado: «Saldo inicial» y «Último saldo registrado» con su período, este último con «CLP: No disponible»

#### Scenario: Sin saldo mensual registrado
- **WHEN** el crédito no tiene ningún registro mensual con saldo
- **THEN** «Último saldo registrado» aparece como «No registrado»

### Requirement: Alcance de T02 respecto de T03
El crédito de T02 SHALL almacenar solo condiciones contractuales. `cuotaContractualUf` es la cuota pactada, no un dividendo pagado. El registro del dividendo pagado y del saldo mensual SHALL pertenecer a `credit-monthly-record` (T03), no a `credito_hipotecario`. El sistema SHALL NOT registrar dividendos pagados, saldos mensuales, saldo actual derivado, amortización ni movimientos financieros en la tabla del crédito.

#### Scenario: Sin columna de saldo vigente
- **WHEN** se inspecciona el esquema del crédito
- **THEN** no existen columnas de saldo actual, dividendo pagado ni equivalente en CLP
