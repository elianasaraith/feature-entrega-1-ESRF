## ADDED Requirements

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
