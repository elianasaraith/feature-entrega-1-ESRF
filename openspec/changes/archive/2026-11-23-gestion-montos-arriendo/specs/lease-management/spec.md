## MODIFIED Requirements

### Requirement: Reajuste actualiza solo los montos esperados desde su período
Al registrar una fila de `contrato_monto`, el sistema SHALL actualizar, en la misma transacción, `monto_esperado_clp` únicamente de los `pago_esperado` ya existentes del contrato con `periodo` mayor o igual a `vigenteDesdePeriodo`, usando para cada uno el monto vigente calculado sobre todas las filas del contrato. Los pagos de períodos anteriores MUST NOT modificarse. El registro de un monto MUST NOT crear pagos. Siempre que cambie `monto_esperado_clp`, el sistema SHALL actualizar `updated_at` de ese pago; un pago cuyo monto no cambia MUST conservar su `updated_at`. Si el nuevo monto cambiaría el monto esperado de algún pago que ya tiene abonos, el sistema SHALL rechazar la operación con 422 indicando los períodos, sin crear la fila ni modificar ningún pago ni abono; un pago con abonos cuyo monto esperado no cambia SHALL NOT bloquear la operación. La comprobación y la escritura SHALL ejecutarse bajo el mismo bloqueo por propiedad que el registro de abonos, de modo que un abono concurrente se registre antes (y bloquee el reajuste) o después (contra el monto ya actualizado).

#### Scenario: Reajuste retroactivo
- **WHEN** existen pagos de 2026-03 a 2026-08 con 500000, sin abonos, y se registra 530000 desde 2026-06
- **THEN** los pagos de 2026-06 en adelante pasan a 530000 y los de 2026-03 a 2026-05 conservan 500000

#### Scenario: Un reajuste anterior no pisa a uno posterior
- **WHEN** existen filas 500000 desde 2026-03 y 560000 desde 2026-09, y se registra 530000 desde 2026-06
- **THEN** los pagos de 2026-06 a 2026-08 quedan en 530000 y los de 2026-09 en adelante siguen en 560000

#### Scenario: updated_at refleja el cambio
- **WHEN** el reajuste cambia el monto esperado de un pago
- **THEN** su `updated_at` es posterior al anterior, y el de un pago sin cambio de monto no varía

#### Scenario: Sin pagos generados
- **WHEN** se registra un reajuste y el contrato aún no tiene pagos esperados
- **THEN** no se crea ninguna fila de `pago_esperado`

#### Scenario: Reajuste que cambiaría un pago con abonos
- **WHEN** se registra un reajuste desde un período cuyo pago esperado tiene abonos y su monto cambiaría
- **THEN** responde 422 con los períodos afectados, no se crea la fila y pagos y abonos quedan intactos

#### Scenario: Pago con abonos cuyo monto no cambia
- **WHEN** el reajuste mantiene el monto esperado de un pago con abonos
- **THEN** la operación procede y ese pago conserva su `updated_at`

#### Scenario: Períodos anteriores con abonos
- **WHEN** hay abonos solo en períodos anteriores al del reajuste
- **THEN** la operación procede y esos pagos no cambian

#### Scenario: Abono concurrente
- **WHEN** se registran a la vez un reajuste y un abono sobre un período afectado
- **THEN** o el reajuste se aplica antes (y el abono se registra contra el monto nuevo) o se rechaza con 422; nunca queda un pago con abonos y monto modificado sin reglas

## ADDED Requirements

### Requirement: Corrección de un monto de arriendo
El sistema SHALL permitir corregir el `monto_mensual_clp` (y opcionalmente el `motivo`) de una fila de `contrato_monto` con `PUT /api/propiedades/{id}/contratos/{contratoId}/montos/{montoId}`. El período `vigente_desde_periodo` SHALL NOT modificarse. La corrección SHALL proceder únicamente si ningún pago esperado cuyo monto esperado cambiaría tiene abonos registrados; en ese caso SHALL actualizar, en la misma transacción, `monto_esperado_clp` de esos pagos al monto que les corresponde con la fila corregida. Los pagos esperados de períodos anteriores a la vigencia de la fila, o regidos por otra fila, SHALL NOT modificarse. Si algún pago afectado tiene abonos, el sistema SHALL responder 422 indicando los períodos, sin modificar la fila, los pagos ni los abonos. Los abonos SHALL NOT modificarse ni eliminarse en ningún caso.

#### Scenario: Corrección sin pagos creados
- **WHEN** se corrige un monto de un contrato sin pagos esperados
- **THEN** responde 200 y solo cambia la fila

#### Scenario: Corrección con pagos sin abonos
- **WHEN** se corrige a 650.000 un monto que rige pagos esperados sin abonos
- **THEN** responde 200 y esos pagos pasan a 650.000

#### Scenario: Bloqueo por abonos
- **WHEN** algún pago esperado que cambiaría tiene un abono
- **THEN** responde 422 con los períodos afectados y fila, pagos y abonos quedan intactos

#### Scenario: Períodos fuera del rango
- **WHEN** se corrige el reajuste que rige desde mayo y existen pagos de marzo y de un reajuste posterior
- **THEN** los pagos de marzo y los regidos por el reajuste posterior no cambian, aunque tengan abonos

#### Scenario: Validación y existencia
- **WHEN** el monto no es un entero positivo, la fila no existe, o pertenece a otro contrato
- **THEN** responde 400 o 404 según corresponda

#### Scenario: Sin sesión
- **WHEN** se llama sin sesión
- **THEN** responde 401

### Requirement: Eliminación guardada de un reajuste
El sistema SHALL permitir eliminar un reajuste (cualquier fila de `contrato_monto` que no sea la de menor `vigente_desde_periodo`) con `DELETE` sobre el mismo recurso, bajo la misma condición de abonos de la corrección: los pagos esperados afectados SHALL pasar al monto de la fila anterior vigente, en la misma transacción. El monto inicial SHALL NOT eliminarse (422). SHALL NOT existir eliminación de otras entidades históricas por esta vía.

#### Scenario: Eliminar un reajuste sin abonos
- **WHEN** se elimina un reajuste cuyo rango no tiene pagos con abonos
- **THEN** responde 200, la fila desaparece y sus pagos pasan al monto anterior

#### Scenario: Eliminar con abonos en el rango
- **WHEN** un pago del rango del reajuste tiene abonos
- **THEN** responde 422 y no cambia nada

#### Scenario: Eliminar el monto inicial
- **WHEN** se intenta eliminar la fila de menor `vigente_desde_periodo`
- **THEN** responde 422 y no cambia nada
