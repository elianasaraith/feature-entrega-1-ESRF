## ADDED Requirements

### Requirement: Registro del primer monto y de reajustes
El sistema SHALL permitir registrar una fila de `contrato_monto` con `montoMensualClp` (entero CLP mayor que 0), `vigenteDesdePeriodo` (mes `YYYY-MM`, almacenado como día 1) y `motivo` opcional, en una única transacción protegida por el bloqueo por propiedad. Si el contrato no tiene ninguna fila, el período MUST ser el mes de `fechaInicio`. Si ya tiene filas, el período MUST estar entre el mes de `fechaInicio` y el mes de `fechaTermino`, ambos inclusive: un período fuera de ese rango SHALL responder 422 y un período ya registrado SHALL responder 409. El sistema SHALL agregar filas y MUST NOT modificar ni eliminar filas anteriores, ni exponer operaciones para ello. El contrato conserva su identidad, arrendatario y garantía.

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

### Requirement: Monto vigente por período
El sistema SHALL calcular el monto vigente de un contrato en un período mediante una función pura de dominio: el de la fila con el mayor `vigenteDesdePeriodo` menor o igual al período, o `null` si ninguna rige. La consulta del historial SHALL devolver las filas ordenadas por `vigenteDesdePeriodo` ascendente y el monto vigente respecto de la fecha de referencia inyectada, sin escribir.

#### Scenario: Mes anterior a un reajuste
- **WHEN** hay filas 500000 desde 2026-03 y 530000 desde 2026-09, y se consulta el período 2026-08
- **THEN** el monto vigente es 500000

#### Scenario: Mes desde el reajuste
- **WHEN** se consulta el período 2026-09 con las mismas filas
- **THEN** el monto vigente es 530000

#### Scenario: Período sin monto
- **WHEN** el período es anterior a la primera fila o el contrato no tiene filas
- **THEN** el monto vigente es `null`

#### Scenario: La consulta no escribe
- **WHEN** se hace GET del historial de montos
- **THEN** no se crea ni modifica ninguna fila de `contrato_monto` ni de `pago_esperado`

### Requirement: Reajuste actualiza solo los montos esperados desde su período
Al registrar una fila de `contrato_monto`, el sistema SHALL actualizar, en la misma transacción, `monto_esperado_clp` únicamente de los `pago_esperado` ya existentes del contrato con `periodo` mayor o igual a `vigenteDesdePeriodo`, usando para cada uno el monto vigente calculado sobre todas las filas del contrato. Los pagos de períodos anteriores MUST NOT modificarse. El registro de un monto MUST NOT crear pagos. Siempre que cambie `monto_esperado_clp`, el sistema SHALL actualizar `updated_at` de ese pago; un pago cuyo monto no cambia MUST conservar su `updated_at`.

#### Scenario: Reajuste retroactivo
- **WHEN** existen pagos de 2026-03 a 2026-08 con 500000 y se registra 530000 desde 2026-06
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

### Requirement: Sincronización explícita de pagos esperados
El sistema SHALL ofrecer una operación explícita (`POST .../pagos-esperados/sincronizar`) que cree los `pago_esperado` faltantes del contrato, desde el mes de `fechaInicio` hasta el menor entre el mes de la fecha de referencia y el mes de `fechaTermino`, siempre que el contrato tenga al menos una fila de `contrato_monto`. Cada pago SHALL tener `periodo` día 1, `monto_esperado_clp` igual al monto vigente en ese período y `fecha_esperada` derivada de `diaEsperadoPago` (último día del mes si el día no existe). La operación SHALL ser idempotente, se ejecuta bajo el bloqueo por propiedad, y MUST NOT modificar ni eliminar pagos existentes. Sin monto registrado SHALL responder 200 sin crear nada. Ningún `GET` ni cron SHALL crear pagos. Un mes sin contrato vigente MUST NOT tener pago esperado.

#### Scenario: Generación desde el mes de inicio
- **WHEN** un contrato con inicio en 2026-03, monto desde 2026-03 y referencia 2026-05 se sincroniza
- **THEN** existen pagos para 2026-03, 2026-04 y 2026-05 con su monto vigente y su fecha esperada

#### Scenario: Idempotencia
- **WHEN** la sincronización se ejecuta dos veces con la misma referencia
- **THEN** la segunda no crea filas y la respuesta indica 0 creados

#### Scenario: Continuación en meses posteriores
- **WHEN** se sincroniza de nuevo con una referencia de meses posteriores
- **THEN** solo se crean los pagos faltantes y los existentes no cambian

#### Scenario: Contrato sin monto
- **WHEN** se sincroniza un contrato sin filas de `contrato_monto`
- **THEN** el sistema responde 200 con 0 creados y no existe ningún pago

#### Scenario: Límite por término del contrato
- **WHEN** la referencia es posterior al mes de `fechaTermino`
- **THEN** no se crean pagos posteriores a ese mes

#### Scenario: Día esperado inexistente en el mes
- **WHEN** `diaEsperadoPago` es 31 y el período es febrero
- **THEN** `fecha_esperada` es el último día de febrero

#### Scenario: Monto de un reajuste anterior a la sincronización
- **WHEN** hay un reajuste desde 2026-06 y los pagos aún no existen
- **THEN** los pagos creados desde 2026-06 llevan el monto reajustado y los anteriores el monto de entonces

### Requirement: Interfaz de montos y pagos esperados
El sistema SHALL ofrecer la página `/propiedades/[id]/contratos/[contratoId]/montos`, protegida por sesión, que muestre el historial de montos (período, monto CLP, motivo), el monto vigente a la fecha de referencia, un formulario para registrar el primer monto o un reajuste, y una acción para sincronizar los pagos esperados con su resultado (creados y existentes). La lista de contratos SHALL enlazar a ella. Los errores 409 y 422 SHALL mostrarse al usuario. Los componentes MUST NOT calcular montos vigentes ni pagos.

#### Scenario: Registrar el primer monto desde la interfaz
- **WHEN** el usuario abre la página de un contrato sin monto y envía un monto válido
- **THEN** el historial muestra la fila y el monto vigente

#### Scenario: Registrar un reajuste desde la interfaz
- **WHEN** el usuario envía un reajuste válido
- **THEN** el historial muestra todas las filas, la anterior sin cambios

#### Scenario: Error de validación visible
- **WHEN** el reajuste recibe 409 o 422
- **THEN** la interfaz muestra el mensaje y no modifica el historial

#### Scenario: Sincronizar desde la interfaz
- **WHEN** el usuario pulsa sincronizar
- **THEN** la interfaz muestra la cantidad de pagos creados y existentes

#### Scenario: Página sin sesión
- **WHEN** se solicita la página sin sesión
- **THEN** el sistema redirige a `/login`

### Requirement: Alcance acotado de T05
El sistema MUST NOT, como parte de este cambio, registrar abonos, calcular o persistir el estado, el saldo o el exceso de un pago, crear movimientos financieros ni aportes de capital, ni asociar documentos a contratos. Los pagos esperados SHALL crearse únicamente mediante la sincronización explícita.

#### Scenario: Sin efectos laterales de T06 o T07
- **WHEN** se registra un monto, un reajuste o se sincronizan pagos
- **THEN** no se crea ninguna fila de abono ni de movimiento financiero y no se persiste estado de pago

#### Scenario: Alta de contrato sin efectos laterales financieros
- **WHEN** se registra un contrato con monto inicial y garantía
- **THEN** no se crea ninguna fila de pago esperado, abono ni movimiento financiero

## MODIFIED Requirements

### Requirement: Monto inicial opcional en contrato_monto
El sistema SHALL aceptar `montoMensualClp` opcional en el alta (entero CLP mayor que 0). Si se informa, el sistema SHALL crear en la misma transacción una fila de `contrato_monto` con ese monto, `vigente_desde_periodo` igual al día 1 del mes de `fechaInicio` y motivo «monto inicial». Si no se informa, el sistema SHALL crear el contrato sin fila de `contrato_monto`; esa excepción a la invariante de `data-model.md` §4.7 («todo contrato tiene al menos una fila») persiste hasta que se registre el primer monto mediante la operación de montos, y se documenta como propuesta a validar. El alta MUST NOT crear pagos esperados.

#### Scenario: Alta con monto inicial
- **WHEN** se registra un contrato con `montoMensualClp` de 500000 y `fechaInicio` 2026-03-15
- **THEN** existe una fila de `contrato_monto` con 500000 y `vigente_desde_periodo` 2026-03-01, y el contrato la expone como monto inicial

#### Scenario: Alta sin monto
- **WHEN** se registra un contrato sin `montoMensualClp`
- **THEN** el sistema responde 201, el contrato no tiene fila de `contrato_monto` y expone el monto inicial como `null`

#### Scenario: Monto inválido
- **WHEN** `montoMensualClp` es 0, negativo, con decimales o excede NUMERIC(14,0)
- **THEN** el sistema responde 400 y no persiste el contrato

#### Scenario: Falla al crear el monto revierte el contrato
- **WHEN** la creación de la fila de `contrato_monto` falla dentro de la transacción
- **THEN** no queda el contrato creado

#### Scenario: El alta no genera pagos
- **WHEN** se registra un contrato con monto inicial
- **THEN** no existe ninguna fila de `pago_esperado` hasta que se sincronice explícitamente

### Requirement: Edición de contrato sin sobrescribir el monto inicial
El sistema SHALL permitir editar un contrato existente con cuerpo completo (`arrendatarioId`, `fechaInicio`, `fechaTermino`, `diaEsperadoPago`, `garantiaClp`, `observaciones`), incluida una terminación anticipada mediante `fechaTermino`. El PUT SHALL NOT aceptar ni modificar `montoMensualClp` y SHALL NOT escribir en `contrato_monto` ni en `pago_esperado`. Mientras el contrato tenga una fila de `contrato_monto`, el sistema MUST rechazar con 409 una edición que cambie el mes de `fechaInicio`, para mantener que la primera fila rija desde el mes de inicio (`data-model.md` §5.1, regla 4). El sistema MUST rechazar con 409 una edición cuyo mes de `fechaTermino` sea anterior al `vigente_desde_periodo` de alguna fila de `contrato_monto` o al `periodo` de algún `pago_esperado` del contrato (`data-model.md` §5.1, reglas 4 y 5; propuesta a validar). Un PUT sobre un contrato inexistente SHALL responder 404 y nunca crear.

#### Scenario: Terminación anticipada
- **WHEN** se actualiza `fechaTermino` a una fecha anterior, sin cambiar el resto, y ningún monto ni pago queda posterior a ese mes
- **THEN** el sistema responde 200 y la vigencia derivada refleja la nueva fecha

#### Scenario: Terminación anterior a un reajuste o a un pago
- **WHEN** el mes de la nueva `fechaTermino` es anterior al de una fila de monto o de un pago esperado existente
- **THEN** el sistema responde 409 y no modifica el contrato

#### Scenario: El monto inicial se preserva
- **WHEN** se edita cualquier campo de un contrato que tiene monto inicial
- **THEN** la fila de `contrato_monto` conserva exactamente su monto, su `vigente_desde_periodo` y sus datos de creación

#### Scenario: El PUT ignora un monto enviado
- **WHEN** el cuerpo del PUT incluye `montoMensualClp`
- **THEN** el sistema no lo aplica y la fila de `contrato_monto` no cambia

#### Scenario: Cambio del mes de inicio con monto inicial
- **WHEN** un PUT cambia el mes de `fechaInicio` de un contrato con fila de `contrato_monto`
- **THEN** el sistema responde 409 y no modifica el contrato

#### Scenario: Contrato inexistente
- **WHEN** se hace PUT a un `contratoId` que no existe o no pertenece a la propiedad indicada
- **THEN** el sistema responde 404 y no crea ningún contrato

### Requirement: Consulta de contratos sucesivos de una propiedad
El sistema SHALL listar los contratos de una propiedad ordenados por `fechaInicio` descendente, cada uno con su arrendatario, fechas, garantía, día esperado de pago, monto inicial (o `null`) y vigencia derivada respecto de una fecha de referencia. Un contrato individual SHALL poder consultarse por id dentro de su propiedad. La consulta de contratos SHALL NOT escribir; el monto vigente se obtiene de la consulta de montos.

#### Scenario: Historial con contratos sucesivos
- **WHEN** una propiedad tiene un contrato terminado y uno posterior con otro arrendatario
- **THEN** el listado devuelve ambos, el más reciente primero, cada uno con su arrendatario y su vigencia

#### Scenario: Propiedad sin contratos
- **WHEN** una propiedad existente no tiene contratos
- **THEN** el sistema responde 200 con una lista vacía

#### Scenario: Contrato de otra propiedad
- **WHEN** se consulta un `contratoId` bajo una propiedad a la que no pertenece
- **THEN** el sistema responde 404

### Requirement: Endpoints y páginas de contratos protegidos por sesión
El sistema SHALL exigir sesión en todos los endpoints de contratos, arrendatarios, montos y sincronización de pagos esperados, respondiendo 401 sin ella, y SHALL redirigir a `/login` las páginas de contratos y de montos sin sesión. Los endpoints de contratos y montos SHALL NOT exponer `DELETE` (405).

#### Scenario: Endpoint sin sesión
- **WHEN** se llama a cualquier endpoint de contratos, arrendatarios, montos o sincronización sin sesión
- **THEN** el sistema responde 401 con un cuerpo JSON

#### Scenario: Página sin sesión
- **WHEN** se solicita una página de contratos o de montos sin sesión
- **THEN** el sistema redirige a `/login`

#### Scenario: DELETE no disponible
- **WHEN** se envía `DELETE` a un contrato, a un arrendatario o a un monto
- **THEN** el sistema responde 405

## REMOVED Requirements

### Requirement: Alcance acotado de T04
**Reason**: T05 introduce reajustes y pagos esperados, que este requisito prohibía; se reemplaza por «Alcance acotado de T05», que mantiene la exclusión de abonos, estado de pago y movimientos.
**Migration**: Aplicar «Alcance acotado de T05». La garantía y el alta de contrato siguen sin efectos financieros.
