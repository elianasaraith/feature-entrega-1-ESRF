# rent-payments Specification

## Purpose

Gestionar los abonos recibidos de los contratos de arriendo, permitiendo registrar, consultar, editar y eliminar pagos, y calcular dinámicamente sus estados, saldos pendientes y fechas de completitud, respetando los reajustes del monto esperado.
## Requirements
### Requirement: Registro de abono
El sistema SHALL permitir registrar, contra un pago esperado existente, un abono con `montoClp` (entero > 0), `fechaRecepcion` y `medio` opcional, mediante `POST /api/propiedades/{id}/contratos/{contratoId}/pagos-esperados/{pagoId}/abonos`. Un pago esperado SHALL admitir uno o varios abonos y el sistema MUST NOT imponer un tope sobre el monto esperado.

#### Scenario: Abono válido
- **WHEN** un usuario autenticado registra un abono con monto positivo y fecha de recepción no futura
- **THEN** el sistema responde 201 con el abono creado

#### Scenario: Varios abonos sobre el mismo pago
- **WHEN** se registra un segundo abono sobre un pago que ya tiene uno
- **THEN** el sistema lo acepta y ambos quedan asociados al pago

#### Scenario: Abono que excede el monto esperado
- **WHEN** la suma de los abonos supera el monto esperado del pago
- **THEN** el sistema acepta el registro sin rechazarlo

#### Scenario: Monto menor o igual a cero
- **WHEN** se envía un abono con `montoClp` igual a 0 o negativo
- **THEN** el sistema responde 422 y no crea el abono

#### Scenario: Fecha de recepción futura
- **WHEN** se envía un abono con `fechaRecepcion` posterior a la fecha de hoy en Chile
- **THEN** el sistema responde 422 y no crea el abono

#### Scenario: Entrada mal formada
- **WHEN** se envía un abono con monto no numérico o fecha con formato inválido
- **THEN** el sistema responde 400 con el error en el campo correspondiente

### Requirement: Consulta de abonos
El sistema SHALL listar los abonos de un pago esperado ordenados por `fechaRecepcion` ascendente, con desempate por `createdAt` e `id`.

#### Scenario: Listado de abonos
- **WHEN** un usuario autenticado consulta `GET .../pagos-esperados/{pagoId}/abonos`
- **THEN** el sistema responde 200 con los abonos del pago en ese orden

#### Scenario: Pago sin abonos
- **WHEN** se consultan los abonos de un pago sin abonos
- **THEN** el sistema responde 200 con una lista vacía

### Requirement: Edición de abono
El sistema SHALL permitir editar `montoClp`, `fechaRecepcion` y `medio` de un abono mediante `PUT .../pagos-esperados/{pagoId}/abonos/{abonoId}`, con las mismas validaciones que el alta. Un abono MUST NOT poder moverse a otro pago esperado.

#### Scenario: Edición válida
- **WHEN** un usuario autenticado edita el monto de un abono con un valor positivo
- **THEN** el sistema responde 200 con el abono actualizado y el estado del pago se recalcula en la siguiente consulta

#### Scenario: Edición con monto no positivo
- **WHEN** se edita un abono con `montoClp` menor o igual a 0
- **THEN** el sistema responde 422 y el abono conserva sus valores

#### Scenario: Edición con fecha futura
- **WHEN** se edita un abono con `fechaRecepcion` posterior a hoy
- **THEN** el sistema responde 422 y el abono conserva sus valores

#### Scenario: Abono inexistente
- **WHEN** se edita un abono que no existe en ese pago
- **THEN** el sistema responde 404

### Requirement: Eliminación de abono
El sistema SHALL permitir eliminar un abono mediante `DELETE .../pagos-esperados/{pagoId}/abonos/{abonoId}`. La eliminación SHALL ser física, sin papelera ni registro de auditoría, y la interfaz MUST pedir confirmación antes de ejecutarla.

#### Scenario: Eliminación válida
- **WHEN** un usuario autenticado elimina un abono existente
- **THEN** el sistema responde 204, el abono deja de existir y el estado del pago se recalcula sin él

#### Scenario: Eliminación del único abono
- **WHEN** se elimina el único abono de un pago
- **THEN** el pago vuelve a `PENDIENTE` o `VENCIDO` según su fecha esperada

#### Scenario: Confirmación en la interfaz
- **WHEN** el usuario pulsa eliminar sobre un abono en la interfaz
- **THEN** la interfaz solicita confirmación y no envía la eliminación hasta que el usuario confirma

### Requirement: Pertenencia de abonos
El sistema SHALL verificar en cada operación sobre abonos que el pago esperado pertenezca al contrato indicado, que el contrato pertenezca a la propiedad indicada y que el abono pertenezca al pago. Las operaciones MUST requerir una sesión autenticada.

#### Scenario: Pago de otro contrato
- **WHEN** se usa un `pagoId` que no pertenece al `contratoId` de la ruta
- **THEN** el sistema responde 404 y no lee ni modifica abonos

#### Scenario: Contrato de otra propiedad
- **WHEN** se usa un `contratoId` que no pertenece a la propiedad de la ruta
- **THEN** el sistema responde 404

#### Scenario: Abono de otro pago
- **WHEN** se edita o elimina un abono con un `pagoId` distinto al suyo
- **THEN** el sistema responde 404 y el abono no cambia

#### Scenario: Sin sesión
- **WHEN** se invoca cualquier operación sin sesión autenticada
- **THEN** el sistema responde 401

### Requirement: Estado derivado del pago de arriendo
El sistema SHALL derivar el estado de cada pago esperado al consultarlo, a partir de la suma de sus abonos vigentes (`recibido`), su `montoEsperadoClp`, su `fechaEsperada` y una fecha de referencia inyectada. Un pago está vencido cuando `fechaEsperada` es anterior a la fecha de referencia. Las reglas SHALL evaluarse en este orden y la primera que se cumple determina el estado: (1) `recibido >= esperado` → `PAGADO`; (2) `recibido < esperado` y vencido → `VENCIDO`; (3) `0 < recibido < esperado` y no vencido → `PARCIALMENTE_PAGADO`; (4) `recibido = 0` y no vencido → `PENDIENTE`. El sistema MUST NOT persistir estado, saldo, fecha de completitud ni calificaciones.

#### Scenario: Un abono cubre el pago
- **WHEN** un abono iguala o supera el monto esperado
- **THEN** el estado es `PAGADO`

#### Scenario: Varios abonos cubren el pago
- **WHEN** la suma de varios abonos alcanza el monto esperado
- **THEN** el estado es `PAGADO`

#### Scenario: Pendiente
- **WHEN** un pago no tiene abonos y su fecha esperada no ha pasado
- **THEN** el estado es `PENDIENTE` con saldo igual al monto esperado

#### Scenario: Parcialmente pagado
- **WHEN** los abonos suman menos que el esperado y la fecha esperada no ha pasado
- **THEN** el estado es `PARCIALMENTE_PAGADO` con el saldo pendiente correspondiente

#### Scenario: Vencido sin abonos
- **WHEN** un pago no tiene abonos y su fecha esperada ya pasó
- **THEN** el estado es `VENCIDO`

#### Scenario: Fecha esperada igual a la fecha de referencia
- **WHEN** la fecha esperada es igual a la fecha de referencia
- **THEN** el pago no se considera vencido

#### Scenario: Sobrepago
- **WHEN** los abonos suman más que el monto esperado (CL14)
- **THEN** el estado es `PAGADO`, el saldo pendiente es 0 y el recibido refleja el total abonado

#### Scenario: El estado cambia por el paso del tiempo
- **WHEN** se consulta el mismo pago sin abonos con una fecha de referencia posterior a su fecha esperada
- **THEN** el estado pasa de `PENDIENTE` a `VENCIDO` sin que se haya modificado ningún dato

#### Scenario: Cambio de estado al editar o eliminar abonos
- **WHEN** se edita o elimina un abono y el acumulado deja de alcanzar el monto esperado
- **THEN** el pago abandona `PAGADO` según las reglas 2 o 3

### Requirement: Calificaciones y fecha de completitud
El sistema SHALL informar, junto al estado, la calificación *vencido con abonos parciales* cuando el estado es `VENCIDO` y `recibido > 0`, y la calificación *pagado con atraso* cuando el estado es `PAGADO` y la fecha de completitud es posterior a `fechaEsperada`. La fecha de completitud SHALL ser la `fechaRecepcion` del primer abono, ordenados por `fechaRecepcion`, `createdAt` e `id`, cuyo acumulado alcanza o supera el monto esperado; si el acumulado nunca lo alcanza, no hay fecha de completitud. Las calificaciones MUST NOT constituir estados adicionales.

#### Scenario: Vencido con abonos parciales
- **WHEN** un pago con abonos parciales tiene la fecha esperada ya pasada (CL11)
- **THEN** el estado es `VENCIDO`, con la calificación de abonos parciales, el total recibido y el saldo pendiente

#### Scenario: Pagado con atraso
- **WHEN** el acumulado de abonos alcanza el esperado en una fecha posterior a la fecha esperada
- **THEN** el estado es `PAGADO` con la calificación *pagado con atraso*

#### Scenario: Pagado a tiempo
- **WHEN** el acumulado alcanza el esperado en una fecha igual o anterior a la fecha esperada
- **THEN** el estado es `PAGADO` sin calificación de atraso

#### Scenario: Fecha de completitud con varios abonos
- **WHEN** dos abonos de fechas distintas suman el esperado
- **THEN** la fecha de completitud es la fecha de recepción del segundo abono

#### Scenario: Abonos con la misma fecha
- **WHEN** varios abonos comparten fecha de recepción
- **THEN** el resultado es determinista según `createdAt` e `id` y la fecha de completitud es ese día

### Requirement: Consulta de pagos esperados con su estado
El sistema SHALL listar los pagos esperados de un contrato, ordenados por período, mediante `GET /api/propiedades/{id}/contratos/{contratoId}/pagos-esperados`, con `montoEsperadoClp`, `fechaEsperada`, monto recibido, saldo pendiente, estado, fecha de completitud y calificaciones. La consulta MUST NOT crear pagos ni escribir datos.

#### Scenario: Listado con estado
- **WHEN** un usuario autenticado consulta los pagos esperados de un contrato
- **THEN** el sistema responde 200 con cada pago y su estado derivado a la fecha de hoy en Chile

#### Scenario: Consulta sin escritura
- **WHEN** un contrato aún no tiene pagos sincronizados y se consulta su listado
- **THEN** el sistema responde 200 con una lista vacía y no crea pagos

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

