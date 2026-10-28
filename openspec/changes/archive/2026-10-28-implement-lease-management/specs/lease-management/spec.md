## ADDED Requirements

### Requirement: Alta de arrendatario
El sistema SHALL permitir registrar un arrendatario con `nombre` (obligatorio), `rut`, `email` y `telefono` (opcionales). El `rut`, si se informa, SHALL ser único. Un arrendatario SHALL poder asociarse a varios contratos sucesivos.

#### Scenario: Alta válida
- **WHEN** un usuario autenticado envía un nombre válido a `POST /api/arrendatarios`
- **THEN** el sistema responde 201 con el arrendatario creado

#### Scenario: Alta sin RUT
- **WHEN** se envía un arrendatario sin `rut`
- **THEN** el sistema lo acepta con `rut` en `null`

#### Scenario: RUT duplicado
- **WHEN** se registra un arrendatario con un `rut` ya existente
- **THEN** el sistema responde 409 y no crea un segundo registro

#### Scenario: Nombre vacío
- **WHEN** se envía un arrendatario sin nombre o solo con espacios
- **THEN** el sistema responde 400 con el error en el campo `nombre`

### Requirement: Listado de arrendatarios
El sistema SHALL listar los arrendatarios registrados, ordenados por nombre.

#### Scenario: Listado con arrendatarios
- **WHEN** un usuario autenticado consulta `GET /api/arrendatarios`
- **THEN** el sistema responde 200 con la lista ordenada por nombre

### Requirement: Alta de contrato de arriendo
El sistema SHALL registrar, para una propiedad existente, un contrato con `fechaInicio`, `fechaTermino`, `diaEsperadoPago` (1 a 31), `garantiaClp` opcional y `observaciones` opcionales, asociado a un arrendatario. `fechaTermino` SHALL ser obligatoria y mayor o igual que `fechaInicio`. El arrendatario SHALL indicarse con `arrendatarioId` (existente) o con un objeto `arrendatario` anidado que se crea en la misma transacción; el sistema MUST rechazar una solicitud que traiga ambos o ninguno.

#### Scenario: Alta con arrendatario existente
- **WHEN** un usuario autenticado envía un contrato válido con `arrendatarioId` de un arrendatario existente
- **THEN** el sistema responde 201 y el contrato queda asociado a ese arrendatario con su vigencia derivada de las fechas

#### Scenario: Alta con arrendatario anidado
- **WHEN** se envía un contrato válido con un `arrendatario` anidado
- **THEN** el sistema crea el arrendatario y el contrato en la misma transacción y responde 201

#### Scenario: Falla del contrato revierte el arrendatario anidado
- **WHEN** el contrato con arrendatario anidado se rechaza por solape
- **THEN** el sistema responde 409 y no deja el arrendatario creado

#### Scenario: Arrendatario ambiguo
- **WHEN** la solicitud trae a la vez `arrendatarioId` y `arrendatario`, o ninguno
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Término anterior al inicio
- **WHEN** `fechaTermino` es anterior a `fechaInicio`
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Día esperado de pago fuera de rango
- **WHEN** `diaEsperadoPago` es 0, 32 o no es entero
- **THEN** el sistema responde 400 y no persiste nada

#### Scenario: Fecha inexistente en el calendario
- **WHEN** una fecha como `2026-02-30` se envía como inicio o término
- **THEN** el sistema responde 400

#### Scenario: Propiedad inexistente
- **WHEN** el id de propiedad no existe o no es un UUID
- **THEN** el sistema responde 404

### Requirement: Verificación del arrendatario antes de asociarlo
El sistema SHALL verificar, antes de asociar un arrendatario a un contrato (alta o edición), que `arrendatarioId` es un UUID y que el arrendatario existe. Dado que el MVP es de usuario único y las entidades no llevan `usuario_id`, la pertenencia al usuario autenticado SHALL garantizarse exigiendo sesión en todo handler; el sistema MUST NOT asociar un arrendatario inexistente.

#### Scenario: Arrendatario inexistente
- **WHEN** se envía un `arrendatarioId` válido que no existe
- **THEN** el sistema responde 404 y no crea el contrato

#### Scenario: Arrendatario con id mal formado
- **WHEN** `arrendatarioId` no es un UUID
- **THEN** el sistema responde 404 sin consultar la base con un valor inválido

#### Scenario: Cambio de arrendatario inexistente en la edición
- **WHEN** un PUT informa un `arrendatarioId` que no existe
- **THEN** el sistema responde 404 y el contrato conserva su arrendatario

### Requirement: Monto inicial opcional en contrato_monto
El sistema SHALL aceptar `montoMensualClp` opcional en el alta (entero CLP mayor que 0). Si se informa, el sistema SHALL crear en la misma transacción una fila de `contrato_monto` con ese monto, `vigente_desde_periodo` igual al día 1 del mes de `fechaInicio` y motivo «monto inicial». Si no se informa, el sistema SHALL crear el contrato sin fila de `contrato_monto`; esta excepción a la invariante de `data-model.md` §4.7 («todo contrato tiene al menos una fila») queda relajada hasta T05 y se documenta como propuesta a validar. El sistema MUST NOT ofrecer ninguna operación para añadir, modificar o eliminar filas de `contrato_monto` (reajustes: T05).

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

#### Scenario: Sin operaciones de reajuste
- **WHEN** se consulta la API de T04
- **THEN** no existe ningún endpoint que cree, modifique o elimine filas adicionales de `contrato_monto`

### Requirement: Edición de contrato sin sobrescribir el monto inicial
El sistema SHALL permitir editar un contrato existente con cuerpo completo (`arrendatarioId`, `fechaInicio`, `fechaTermino`, `diaEsperadoPago`, `garantiaClp`, `observaciones`), incluida una terminación anticipada mediante `fechaTermino`. El PUT SHALL NOT aceptar ni modificar `montoMensualClp` y SHALL NOT escribir en `contrato_monto`. Mientras el contrato tenga una fila de `contrato_monto`, el sistema MUST rechazar con 409 una edición que cambie el mes de `fechaInicio`, para mantener que la primera fila rija desde el mes de inicio (`data-model.md` §5.1, regla 4). Un PUT sobre un contrato inexistente SHALL responder 404 y nunca crear.

#### Scenario: Terminación anticipada
- **WHEN** se actualiza `fechaTermino` a una fecha anterior, sin cambiar el resto
- **THEN** el sistema responde 200 y la vigencia derivada refleja la nueva fecha

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

### Requirement: Vigencia derivada de las fechas
El sistema SHALL derivar la vigencia de un contrato desde `fechaInicio` y `fechaTermino`, sin persistir un estado. Dada una fecha de referencia inyectada, la vigencia SHALL ser `FUTURO` si la referencia es anterior a `fechaInicio`, `VIGENTE` si está dentro de `[fechaInicio, fechaTermino]` con ambos extremos inclusivos, y `FINALIZADO` si es posterior a `fechaTermino`. El cálculo MUST NOT leer el reloj del sistema dentro de la función de dominio.

#### Scenario: Contrato futuro
- **WHEN** la fecha de referencia es anterior a `fechaInicio`
- **THEN** la vigencia es `FUTURO`

#### Scenario: Extremos inclusivos
- **WHEN** la fecha de referencia es igual a `fechaInicio` o igual a `fechaTermino`
- **THEN** la vigencia es `VIGENTE`

#### Scenario: Contrato finalizado
- **WHEN** la fecha de referencia es posterior a `fechaTermino`
- **THEN** la vigencia es `FINALIZADO`

#### Scenario: Sin columna de estado
- **WHEN** se revisa el modelo de datos de `contrato_arriendo`
- **THEN** no existe una columna `estado`

### Requirement: Contratos de una propiedad no se solapan
El sistema SHALL rechazar con 409 un alta o una edición cuyo rango `[fechaInicio, fechaTermino]` se solape con el de otro contrato de la misma propiedad. El solape SHALL evaluarse con extremos inclusivos: dos rangos se solapan si `inicioA <= terminoB` y `inicioB <= terminoA`. En una edición se SHALL excluir el propio contrato. Los contratos de propiedades distintas no se afectan entre sí.

#### Scenario: Rangos con solape parcial
- **WHEN** existe un contrato 2026-01-01 a 2026-12-31 y se registra otro 2026-06-01 a 2027-05-31 en la misma propiedad
- **THEN** el sistema responde 409 y no crea el segundo

#### Scenario: Borde compartido
- **WHEN** un contrato termina el 2026-12-31 y se registra otro que empieza el 2026-12-31
- **THEN** el sistema responde 409

#### Scenario: Contratos sucesivos sin solape
- **WHEN** un contrato termina el 2026-12-31 y se registra otro con otro arrendatario desde el 2027-01-01
- **THEN** el sistema responde 201 y ambos constan en el historial con su vigencia

#### Scenario: Mismo rango en otra propiedad
- **WHEN** se registra un contrato con el mismo rango que uno de otra propiedad
- **THEN** el sistema responde 201

#### Scenario: Edición que provoca solape
- **WHEN** un PUT extiende `fechaTermino` hasta tocar el contrato siguiente
- **THEN** el sistema responde 409 y no modifica el contrato

#### Scenario: Edición sin solape consigo mismo
- **WHEN** un PUT mantiene el rango del propio contrato
- **THEN** el sistema responde 200

### Requirement: Bloqueo por propiedad ante operaciones simultáneas
El sistema SHALL serializar las operaciones de alta (POST) y edición (PUT) de contratos de una misma propiedad mediante un bloqueo transaccional por propiedad, tomado antes de comprobar el solape y mantenido hasta el final de la transacción. El mismo mecanismo SHALL aplicarse en POST y en PUT. No se SHALL introducir infraestructura adicional.

#### Scenario: Dos altas simultáneas con solape
- **WHEN** dos POST con rangos solapados para la misma propiedad se ejecutan en paralelo
- **THEN** exactamente uno responde 201 y el otro 409, y la propiedad queda con un solo contrato en ese rango

#### Scenario: Alta y edición simultáneas
- **WHEN** un POST y un PUT que, juntos, provocarían solape en la misma propiedad se ejecutan en paralelo
- **THEN** a lo sumo uno se confirma y el otro responde 409

#### Scenario: Propiedades distintas no se bloquean entre sí
- **WHEN** se ejecutan altas simultáneas en propiedades distintas
- **THEN** ambas se confirman sin 409

### Requirement: Consulta de contratos sucesivos de una propiedad
El sistema SHALL listar los contratos de una propiedad ordenados por `fechaInicio` descendente, cada uno con su arrendatario, fechas, garantía, día esperado de pago, monto inicial (o `null`) y vigencia derivada respecto de una fecha de referencia. Un contrato individual SHALL poder consultarse por id dentro de su propiedad. Las consultas SHALL NOT calcular ni exponer un "monto vigente".

#### Scenario: Historial con contratos sucesivos
- **WHEN** una propiedad tiene un contrato terminado y uno posterior con otro arrendatario
- **THEN** el listado devuelve ambos, el más reciente primero, cada uno con su arrendatario y su vigencia

#### Scenario: Propiedad sin contratos
- **WHEN** una propiedad existente no tiene contratos
- **THEN** el sistema responde 200 con una lista vacía

#### Scenario: Contrato de otra propiedad
- **WHEN** se consulta un `contratoId` bajo una propiedad a la que no pertenece
- **THEN** el sistema responde 404

### Requirement: La garantía es información contractual
El sistema SHALL guardar `garantiaClp` (entero CLP mayor o igual que 0, opcional) solo como dato del contrato. El sistema MUST NOT crear ingresos, movimientos financieros ni pagos esperados a partir de la garantía, ni exponerla como parte de ningún flujo mensual.

#### Scenario: Garantía registrada
- **WHEN** se registra un contrato con garantía de 500000
- **THEN** el contrato expone la garantía y no se crea ningún ingreso ni movimiento

#### Scenario: Garantía cero u omitida
- **WHEN** la garantía es 0 o se omite
- **THEN** el sistema acepta el contrato

#### Scenario: Garantía inválida
- **WHEN** la garantía es negativa o tiene decimales
- **THEN** el sistema responde 400

### Requirement: Endpoints y páginas de contratos protegidos por sesión
El sistema SHALL exigir sesión en todos los endpoints de contratos y arrendatarios, respondiendo 401 sin ella, y SHALL redirigir a `/login` las páginas de contratos sin sesión. Los endpoints de contratos SHALL NOT exponer `DELETE` (405).

#### Scenario: Endpoint sin sesión
- **WHEN** se llama a cualquier endpoint de contratos o arrendatarios sin sesión
- **THEN** el sistema responde 401 con un cuerpo JSON

#### Scenario: Página sin sesión
- **WHEN** se solicita una página de contratos sin sesión
- **THEN** el sistema redirige a `/login`

#### Scenario: DELETE no disponible
- **WHEN** se envía `DELETE` a un contrato o a un arrendatario
- **THEN** el sistema responde 405

### Requirement: Alcance acotado de T04
El sistema MUST NOT, como parte de este cambio, crear ni calcular pagos esperados, abonos, reajustes, movimientos financieros ni aportes de capital, ni asociar documentos a contratos.

#### Scenario: Alta de contrato sin efectos laterales financieros
- **WHEN** se registra un contrato con monto inicial y garantía
- **THEN** no se crea ninguna fila de pago esperado, abono ni movimiento financiero
