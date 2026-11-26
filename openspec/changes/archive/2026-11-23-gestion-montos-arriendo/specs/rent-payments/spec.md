## MODIFIED Requirements

### Requirement: Reajustes y sincronización con abonos
El sistema SHALL conservar los abonos ante cualquier cambio de montos: ningún alta, corrección o eliminación de un monto o reajuste MUST modificar, eliminar ni reasignar abonos. Un reajuste (o corrección o eliminación de un monto) que modificaría `montoEsperadoClp` de un pago que ya tiene abonos SHALL rechazarse con 422, sin cambios parciales; un pago con abonos cuyo monto esperado no cambia MUST NOT bloquearlo. El estado SHALL derivarse siempre sobre el monto esperado vigente del pago, con las reglas de estado, saldo y fecha de completitud vigentes. La sincronización de pagos esperados SHALL seguir siendo una operación explícita y MUST NOT ejecutarse al registrar, editar, eliminar o consultar abonos.

#### Scenario: Reajuste retroactivo sobre un pago con abonos
- **WHEN** un reajuste subiría el monto esperado a 530.000 de un pago con 500.000 abonados (CL12/CL13 con reajuste)
- **THEN** responde 422, el monto esperado, los abonos y el estado derivado del pago no cambian

#### Scenario: Reajuste que bajaría el monto esperado de un pago con abonos
- **WHEN** un reajuste bajaría el monto esperado por debajo de lo abonado (CL14 con reajuste)
- **THEN** responde 422, los abonos y la fecha de completitud no cambian

#### Scenario: Reajuste hacia adelante
- **WHEN** hay abonos solo en períodos anteriores al del reajuste
- **THEN** el reajuste se aplica a los pagos sin abonos y los abonos y pagos anteriores no cambian

#### Scenario: Pago con abonos cuyo monto no cambia
- **WHEN** un reajuste mantiene el monto esperado de un pago con abonos
- **THEN** no se bloquea y el pago conserva su `updated_at`

#### Scenario: Estado derivado sobre un monto esperado vencido con abonos parciales
- **WHEN** un pago tiene monto esperado 530.000, 500.000 abonados y la fecha esperada ya pasó (CL12)
- **THEN** el estado es `VENCIDO` con abonos parciales y saldo 30.000

#### Scenario: Estado derivado sobre un monto esperado no vencido
- **WHEN** el mismo pago consulta con la fecha esperada aún no vencida (CL13)
- **THEN** el estado es `PARCIALMENTE_PAGADO` con saldo 30.000

#### Scenario: Estado derivado con abonos que superan el monto esperado
- **WHEN** los abonos de un pago superan o igualan su monto esperado (CL14)
- **THEN** el estado es `PAGADO` y la fecha de completitud es la del abono que basta

#### Scenario: Registro de abono no sincroniza
- **WHEN** se registra un abono sobre un pago existente
- **THEN** no se crean ni modifican otros pagos esperados
