## ADDED Requirements

### Requirement: Equivalente en CLP opcional del saldo mensual
El sistema SHALL añadir a cada elemento del historial y de la consulta de un mes un equivalente en CLP del saldo pendiente, calculado en el backend con la UF del `periodo` de ese registro, junto con la fecha de referencia de la UF usada. Si el registro no tiene saldo, o no existe UF para su período, el equivalente SHALL ser `null`. El orden, los campos previos y el comportamiento de los períodos sin registro SHALL NOT cambiar. La interfaz SHALL mostrar el equivalente con la fecha de referencia, o «No disponible».

#### Scenario: Saldo con UF disponible
- **WHEN** un registro de marzo tiene `saldoPendienteUf` y existe la UF de marzo
- **THEN** el historial incluye el equivalente en CLP con la UF del 1 de marzo y su fecha de referencia

#### Scenario: Cada registro usa su propio período
- **WHEN** el historial tiene saldos de enero y febrero
- **THEN** cada equivalente se calcula con la UF de su propio período y nunca con la de otro

#### Scenario: Registro sin saldo
- **WHEN** un registro solo tiene dividendo
- **THEN** su equivalente en CLP es `null` y no se muestra «No disponible» como si faltara la UF

#### Scenario: UF no disponible
- **WHEN** no existe UF para el período de un registro con saldo
- **THEN** la consulta responde 200, el saldo se entrega en UF y el equivalente es `null`

## MODIFIED Requirements

### Requirement: Responsabilidad acotada del registro mensual
El registro mensual SHALL ser el único lugar donde se registra el dividendo hipotecario. El sistema SHALL NOT crear movimientos financieros ni una categoría `DIVIDENDO` a partir de él, SHALL NOT agregar flujos ni calcular flujo neto, y SHALL NOT persistir equivalentes en CLP en `credito_registro_mensual`. La conversión del saldo a CLP, solo en la respuesta y de forma opcional, pertenece a T10. La imputación del egreso al mes de caja por `fechaPagoDividendo` queda para T09.

#### Scenario: Registro sin efectos financieros adicionales
- **WHEN** se registra un dividendo
- **THEN** no se crea ningún movimiento financiero y solo cambia `credito_registro_mensual`

#### Scenario: Equivalente del saldo no persistido
- **WHEN** se muestra un saldo con su equivalente en CLP
- **THEN** el equivalente se calculó al consultar y ninguna columna de `credito_registro_mensual` lo almacena
