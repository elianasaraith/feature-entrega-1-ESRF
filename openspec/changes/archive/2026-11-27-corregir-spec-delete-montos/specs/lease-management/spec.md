## MODIFIED Requirements

### Requirement: Endpoints y páginas de contratos protegidos por sesión
El sistema SHALL exigir sesión en todos los endpoints de contratos, arrendatarios, montos y sincronización de pagos esperados, respondiendo 401 sin ella, y SHALL redirigir a `/login` las páginas de contratos y de montos sin sesión. El recurso de un contrato, el de un arrendatario y la colección de montos de un contrato SHALL NOT exponer `DELETE` (405). El recurso de un monto individual (`.../montos/{montoId}`) sí expone `DELETE`, regido por el requisito «Eliminación guardada de un reajuste».

#### Scenario: Endpoint sin sesión
- **WHEN** se llama a cualquier endpoint de contratos, arrendatarios, montos o sincronización sin sesión
- **THEN** el sistema responde 401 con un cuerpo JSON

#### Scenario: Página sin sesión
- **WHEN** se solicita una página de contratos o de montos sin sesión
- **THEN** el sistema redirige a `/login`

#### Scenario: DELETE no disponible
- **WHEN** se envía `DELETE` a un contrato, a un arrendatario o a la colección de montos de un contrato
- **THEN** el sistema responde 405

### Requirement: Registro del primer monto y de reajustes
El sistema SHALL permitir registrar una fila de `contrato_monto` con `montoMensualClp` (entero CLP mayor que 0), `vigenteDesdePeriodo` (mes `YYYY-MM`, almacenado como día 1) y `motivo` opcional, en una única transacción protegida por el bloqueo por propiedad. Si el contrato no tiene ninguna fila, el período MUST ser el mes de `fechaInicio`. Si ya tiene filas, el período MUST estar entre el mes de `fechaInicio` y el mes de `fechaTermino`, ambos inclusive: un período fuera de ese rango SHALL responder 422 y un período ya registrado SHALL responder 409. El registro SHALL agregar filas y MUST NOT modificar ni eliminar filas anteriores; la corrección y la eliminación son operaciones separadas, regidas por «Corrección de un monto de arriendo» y «Eliminación guardada de un reajuste». El contrato conserva su identidad, arrendatario y garantía.

#### Scenario: Primer monto de un contrato sin monto
- **WHEN** se registra 500000 con período igual al mes de `fechaInicio` en un contrato sin filas de `contrato_monto`
- **THEN** el sistema responde 201 y existe una fila con `vigente_desde_periodo` igual al día 1 de ese mes

#### Scenario: Primer monto con período distinto al mes de inicio
- **WHEN** un contrato sin filas recibe un monto con período distinto al mes de `fechaInicio`
- **THEN** el sistema responde 422 y no crea la fila

#### Scenario: Reajuste sin crear contrato nuevo
- **WHEN** un contrato con monto 500000 recibe un reajuste a 530000 desde un mes dentro de su vigencia
- **THEN** el sistema responde 201, agrega una fila, y el contrato conserva `id`, arrendatario y garantía

#### Scenario: Las filas anteriores no se alteran
- **WHEN** se registra un reajuste
- **THEN** las filas previas conservan exactamente su monto, su período y su `updated_at`

#### Scenario: Reajuste anterior al inicio o posterior al término
- **WHEN** el período es anterior al mes de `fechaInicio` o posterior al mes de `fechaTermino`
- **THEN** el sistema responde 422 y no persiste nada

#### Scenario: Período ya registrado
- **WHEN** el período coincide con el de una fila existente del contrato
- **THEN** el sistema responde 409 y la fila existente no cambia

#### Scenario: Monto inválido
- **WHEN** `montoMensualClp` es 0, negativo, con decimales o excede NUMERIC(14,0), o el período no es un mes válido
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Contrato inexistente
- **WHEN** el `contratoId` no existe o no pertenece a la propiedad indicada
- **THEN** el sistema responde 404
