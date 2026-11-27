# RealtyTrack — Tickets de trabajo

## 1. Propósito y alcance

Este documento es el **backlog técnico completo** del MVP: la unidad de trabajo entre el
diseño ya cerrado (`product.md`, `user-stories.md`, `data-model.md`, `architecture.md`) y
la implementación.

> **Estado.** El backlog es la fuente del trabajo; el estado real de cada ticket está en su
> bloque «Estado de implementación». T01–T07, T09–T12 están implementados (T08 cancelado);
> la aplicación está desplegada en
> <https://realtytrack.vercel.app> (Vercel, Neon y Cloudflare R2). Las notas de verificación de
> cada ticket describen el momento de su cierre. Lo que un ticket describe sin bloque de
> estado es diseño.

**Relación con `readme.md` §6.** La plantilla oficial exige documentar allí 3 tickets
representativos —uno de backend, uno de frontend, uno de base de datos—. Ese límite es
del README, no de este documento: aquí se recoge el backlog íntegro, igual que
`user-stories.md` recoge más historias de las 3 que el README selecciona. §7 propone
candidatos, sin cerrar esa selección.

## 2. Cómo leer este documento

Cada ticket es una **rebanada vertical**: toca su propia UI, su propia API, su propio
servicio y, cuando corresponde, su propio dominio puro y su propio fragmento de esquema.
Ninguno es una capa técnica aislada ("crear tabla", "configurar librería"): la
infraestructura necesaria vive dentro del ticket funcional que la necesita, salvo tres
capacidades genuinamente transversales (T10, T11, T12) que el propio `architecture.md` ya
describe como puertos independientes, consumidos por más de una historia.

**Criterios de aceptación.** Se derivan de `user-stories.md`: son una selección, no la
totalidad de los escenarios y casos límite de cada HU. T10–T12 no tienen HU propia —
`user-stories.md` lo dice explícitamente de la autenticación, y lo mismo aplica por
extensión a la integración de UF y al almacenamiento de documentos, que son la misma clase
de capacidad transversal—, así que sus criterios se derivan directamente de `product.md`
y `data-model.md`, con esa salvedad marcada en cada caso.

**Reglas cerradas.** Once reglas de negocio y de modelo ya cerradas en los documentos
anteriores atraviesan varios tickets. Cada ticket las cita donde le aplican; no se
repiten íntegras en cada uno.

## 3. Resumen del backlog

| # | Título | Tipo | HU | Dependencias |
|---|---|---|---|---|
| T01 | Gestión de propiedades | full-stack | HU01 | — |
| T02 | Alta y condiciones del crédito hipotecario | full-stack | HU01 | T01 · T10 |
| T03 | Registro mensual de dividendo y saldo del crédito | full-stack | HU01 | T02 |
| T04 | Gestión del contrato de arriendo | full-stack | HU02 | T01 |
| T05 | Reajustes de arriendo y generación de pagos esperados | backend | HU02 | T04 |
| T06 | Registro de abonos y estado del pago de arriendo | backend | HU02 | T05 |
| T07 | Movimientos financieros (egresos e inversiones) | full-stack | HU03 | T01 |
| T08 | ~~Aportes de capital~~ *(cancelado por decisión de producto)* | — | — | — |
| T09 | Dashboard financiero mensual | full-stack | HU03 | T03 · T06 · T07 · T10 |
| T10 | Integración con la API de UF | transversal | — | — |
| T11 | Almacenamiento de documentos | transversal | — | T01 (siempre) · T02/T04/T06 (por vínculo) |
| T12 | Acceso protegido de usuario único | transversal | — | — |

---

## 4. Tickets

### 4.1 T01 — Gestión de propiedades

**Tipo:** full-stack · **Historia de usuario:** HU01

**Objetivo.** Registrar y consultar las propiedades de la cartera, con sus datos físicos
y de compra, permitiendo que estacionamiento y bodega queden ausentes cuando corresponda.

**Contexto funcional.** Es el punto de partida de todo el sistema: sin una propiedad
registrada no existen crédito, contrato, pagos ni flujo financiero (`user-stories.md`,
HU01 "Contexto y alcance"). El producto se diseña para N propiedades; las tres iniciales
son datos de carga, no una característica del diseño (`product.md` §5, §7.2).

**Alcance.**
- Alta de una propiedad con número de departamento, superficie, valor de compra (monto +
  moneda) y fecha de compra.
- Estacionamiento y bodega como campos opcionales.
- Consulta de una propiedad y del listado completo de la cartera.
- Ninguna validación de tamaño de cartera.

**Criterios de aceptación** (de `user-stories.md`, HU01):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E1 — Alta de una propiedad | Al registrarla con número de departamento, superficie, valor y fecha de compra, queda disponible y consultable |
| AC2 | E2 — Estacionamiento y bodega opcionales | Al guardar una propiedad sin ninguno de los dos, es válida y ambos constan como ausentes |
| AC3 | E3 — Cartera de tamaño arbitrario | Una cuarta propiedad se incorpora igual que las anteriores, sin trato diferenciado |

**Entidades involucradas:** `propiedad` (`data-model.md` §4.2).

**Componentes y capas arquitectónicas:**
- UI: `app/propiedades/` — listado y detalle (`architecture.md` §7).
- API: Route Handler de propiedades, capacidad "Gestión de propiedades" (`architecture.md`
  §8.3).
- Persistencia: tabla `propiedad`, con la precisión de `valor_compra_monto` fijada en
  `data-model.md` §2.

**Dependencias:** ninguna. Es el ticket fundacional.

**Fuera de alcance:** valorización de mercado o tasaciones (`product.md` §5.1); crédito
hipotecario (T02); documentos de la propiedad (T11); acceso protegido (T12, se asume como
prerrequisito de plataforma, no como alcance de este ticket).

**Estrategia de pruebas:**
- Integración de servicios: alta con y sin estacionamiento/bodega; `superficie_m2` y
  `valor_compra_monto` respetan sus restricciones de signo.
- API: 201 en alta válida, 400 en entrada inválida.

---

### 4.2 T02 — Alta y condiciones del crédito hipotecario

**Tipo:** full-stack · **Historia de usuario:** HU01

**Objetivo.** Registrar el crédito hipotecario asociado a una propiedad, con sus
condiciones contractuales en UF, sabiendo que el crédito es opcional y como máximo uno
por propiedad.

**Contexto funcional.** Los datos contractuales del crédito conservan su unidad natural en
UF; un equivalente en CLP puede acompañarlos sin reemplazarlos (`product.md` §6.2, §7.1).
El sistema no reproduce la lógica de amortización del banco.

**Alcance.**
- Alta de `credito_hipotecario` con banco, cuota pactada, tasa, número de cuotas, seguros,
  día de vencimiento y datos contractuales, en UF.
- Consulta de la cuota y el saldo inicial en UF, con equivalente en CLP calculado a partir
  de `valor_uf_periodo` (T10), sin sustituir el valor original.
- `UNIQUE(propiedad_id)`: como máximo un crédito por propiedad.

**Criterios de aceptación** (de `user-stories.md`, HU01):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E4 — Crédito asociado a una propiedad | Con banco, cuota, saldo, tasa, cuotas, seguros y vencimiento, el crédito queda asociado únicamente a esa propiedad |
| AC2 | E5 — La cuota y el saldo conservan su unidad en UF | Ambos se presentan en UF |
| AC3 | E6 — El equivalente en CLP no reemplaza la UF | El equivalente se calcula con el valor de la UF del período; el valor original en UF sigue presente |
| AC4 | CL10 — Propiedad sin crédito hipotecario | Una propiedad sin crédito es válida y no presenta dividendo ni saldo pendiente |

**Entidades involucradas:** `credito_hipotecario` (`data-model.md` §4.3); lee
`valor_uf_periodo` (T10) para el equivalente en CLP.

**Componentes y capas arquitectónicas:**
- UI: `app/propiedades/[id]/credito` (`architecture.md` §7).
- API: Route Handler de crédito, capacidad "Gestión del crédito" (`architecture.md` §8.3).
- Dominio: función pura de conversión UF → CLP (`architecture.md` §5, §10.1), consumiendo
  el puerto `ProveedorUf` de T10.
- Persistencia: tabla `credito_hipotecario`, `UNIQUE(propiedad_id)`.

**Dependencias:** T01 (`propiedad_id`) · T10 (conversión UF → CLP, AC3). El vínculo de
documentos del crédito no bloquea este ticket: es T11 quien depende de que
`credito_hipotecario` ya exista, no al revés.

**Fuera de alcance:** simulación de amortización (excluida por decisión de producto);
registro mensual de dividendo y saldo (T03); documentos del crédito (T11).

**Estrategia de pruebas:**
- Integración de servicios: alta de crédito; un segundo alta sobre la misma propiedad
  falla por `UNIQUE(propiedad_id)`.
- Unitario de dominio: conversión UF → CLP con un valor fijo de `valor_uf_periodo`.
- API: 409 al intentar un segundo crédito sobre la misma propiedad.

**Estado de implementación (T02, ampliación `porcentaje-pie-hipotecario`).** Se añadió
`credito_hipotecario.porcentaje_pie` (`NUMERIC(5,2)`, opcional, `CHECK` 0–100; `null` = no
informado, `0` es válido). Es un dato informado: no se deduce del monto original ni modifica
montos, dividendos, saldos, UF, pagos o dashboard, y no es un egreso. La consulta con equivalentes
añade `pieEstimado` (valor de compra × porcentaje / 100, en la moneda del valor de compra, calculado
al consultar) y el detalle del crédito muestra porcentaje, monto estimado y barra pie/resto.
Migración `20261124120000_add_credito_porcentaje_pie` no destructiva (debe aplicarse con
`npx prisma migrate deploy`). Validado localmente por la persona.

---

### 4.3 T03 — Registro mensual de dividendo y saldo del crédito

**Tipo:** full-stack · **Historia de usuario:** HU01

**Objetivo.** Registrar cada mes el dividendo efectivamente pagado y el saldo pendiente
informado por el banco, conservando la serie mensual para consultar cualquier mes anterior
con el mismo detalle que el actual.

**Contexto funcional.** El dividendo se registra en CLP (desembolso real); el saldo en UF
(dato del banco). `periodo` identifica la mensualidad hipotecaria; `fecha_pago_dividendo`
identifica la fecha de caja — son datos distintos y ninguno sustituye al otro
(`data-model.md` §4.4). El sistema no estima ni arrastra el mes anterior cuando no hay
registro.

**Alcance.**
- Alta de una fila en `credito_registro_mensual` por mensualidad, con saldo, dividendo o
  ambos — nunca ambos ausentes.
- Si hay dividendo, `fecha_pago_dividendo` es obligatoria; si no lo hay, debe ser nula.
- Consulta del histórico por período, incluidos meses anteriores.

**Criterios de aceptación** (de `user-stories.md`, HU01):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E7 — Registro mensual del dividendo y del saldo | El dividendo pagado (CLP) y el saldo pendiente (UF) quedan asociados a ese mes |
| AC2 | E8 — Consulta del histórico mensual | Un mes anterior devuelve el dividendo y el saldo que correspondían entonces, no los del mes en curso |
| AC3 | CL11 — Mes sin registro del crédito | Sin registro, ambos constan como no registrados, sin estimación ni arrastre |
| AC4 | CL12 — Sin amortización calculada | El saldo no se recalcula ni se proyecta al mes siguiente sin registro nuevo |

**Entidades involucradas:** `credito_registro_mensual` (`data-model.md` §4.4).

**Componentes y capas arquitectónicas:**
- UI: `app/propiedades/[id]/credito/registro-mensual` (`architecture.md` §7).
- API: Route Handler de registro mensual, capacidad "Gestión del crédito"
  (`architecture.md` §8.3).
- Persistencia: los dos `CHECK` de `credito_registro_mensual` y `UNIQUE(credito_id,
  periodo)` (`data-model.md` §4.4).
- Servicios: saldo actual derivado del `periodo` máximo registrado, sin columna
  `saldo_actual` (`data-model.md` §6; `architecture.md` §5).

**Dependencias:** T02 (`credito_id`).

**Fuera de alcance:** amortización o simulación; consolidación del dividendo dentro del
flujo del mes (T09); imputación a la caja por `fecha_pago_dividendo` (la usa T09, este
ticket solo la registra).

**Estrategia de pruebas:**
- Integración de servicios: los `CHECK` rechazan una fila con saldo y dividendo ambos
  nulos, un dividendo sin `fecha_pago_dividendo` y una fecha sin dividendo.
- Integración: consulta de un mes con fila y de un mes sin fila (AC3) devuelven resultados
  correctos y distintos.
- API: 201 en alta válida, 400 al violar un `CHECK`.

---

### 4.4 T04 — Gestión del contrato de arriendo

**Tipo:** full-stack · **Historia de usuario:** HU02

**Objetivo.** Registrar el contrato de arriendo de una propiedad con su arrendatario,
vigencia, garantía y día esperado de pago, permitiendo contratos sucesivos con períodos de
vacancia entre ellos.

**Contexto funcional.** Un contrato conserva su identidad durante toda su vigencia; la
garantía es información contractual, no un ingreso recurrente (`product.md` §6.3, §7.1).

**Alcance.**
- Alta de `arrendatario` (reutilizable entre contratos) y `contrato_arriendo` con fechas
  de inicio/término, garantía y día esperado de pago.
- Validación de que los contratos de una misma propiedad no se solapan.
- Consulta de contratos sucesivos de una propiedad, cada uno con su vigencia y
  arrendatario.

**Criterios de aceptación** (de `user-stories.md`, HU02):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E1 — Alta de un contrato | Con arrendatario, fechas, monto, garantía y día esperado, el contrato queda vigente en el rango indicado |
| AC2 | E16 — Contratos sucesivos | Un contrato terminado y uno posterior con otro arrendatario constan ambos en el histórico, con su vigencia |
| AC3 | E17 — La garantía no es ingreso del mes | La garantía consta como información contractual y no figura entre los ingresos del mes |

**Entidades involucradas:** `arrendatario`, `contrato_arriendo` (`data-model.md` §4.5,
§4.6) y, solo para el **monto inicial opcional**, la primera fila de `contrato_monto`
(§4.7). Si el alta informa el monto, T04 crea esa fila en la misma transacción; si no, el
contrato queda sin fila y la invariante «al menos una fila» se relaja hasta que T05
registre el primer monto (*propuesta a validar*). Reajustes, nuevas filas y el cálculo del
monto vigente son T05.

**Componentes y capas arquitectónicas:**
- UI: `app/contratos/` (`architecture.md` §7).
- API: Route Handler de contratos, capacidad "Contratos y arriendos" (`architecture.md`
  §8.3).
- Servicios: validación de no solapamiento entre contratos de una misma propiedad
  (`data-model.md` §5.1).

**Dependencias:** T01 (`propiedad_id`). Los documentos contractuales no bloquean este
ticket: es T11 quien depende de que `contrato_arriendo` ya exista, no al revés.

**Fuera de alcance:** generación o firma de contratos (`product.md` §8); monto y sus
reajustes (T05); pagos esperados y abonos (T05, T06); gestión de la garantía —devolución,
retención— (fuera de alcance del MVP); documentos del contrato (T11).

**Estrategia de pruebas:**
- Integración de servicios: dos contratos de la misma propiedad con fechas solapadas se
  rechazan; con fechas sucesivas sin solape, se aceptan.
- API: 201 en alta válida, 409 en solapamiento.

---

**Estado de implementación (T04, ampliación `edicion-arrendatarios`).** Se añadió la
**edición de arrendatarios**: `GET` y `PUT /api/arrendatarios/{id}` (mismos campos y validación
que el alta; el `id`, los contratos y el historial no cambian; RUT duplicado → 409). Se edita
desde la lista de contratos de la propiedad («Editar arrendatario»), sin módulo aparte. **No
existe eliminación de arrendatarios.**

### 4.5 T05 — Reajustes de arriendo y generación de pagos esperados

**Tipo:** backend · **Historia de usuario:** HU02

**Objetivo.** Conservar el histórico de montos aplicados a un contrato —incluidos los
reajustes retroactivos— y generar y recalcular los pagos esperados de cada período
vigente, sin depender de un proceso programado ni de un disparo desde la interfaz.

**Contexto funcional.** El monto inicial es la primera fila de `contrato_monto`, no una
columna del contrato; un reajuste es simplemente otra fila (`data-model.md` §4.7). El pago
esperado se genera desde el contrato vigente, con el monto que regía en ese período
(`product.md` §7.1); es responsabilidad de la capa de servicios, idempotente vía
`UNIQUE(contrato_id, periodo)`, sin cron ni generación desde la UI (`architecture.md`
§5.4).

**Relación con T04 (*propuesta a validar*).** T04 permite crear contratos **sin monto
mensual inicial**: un contrato puede existir sin ninguna fila en `contrato_monto`, y la
invariante «todo contrato tiene al menos una fila» (`data-model.md` §4.7) queda relajada
hasta este ticket. T04 solo crea la fila inicial cuando el alta informa el monto, y nunca la
modifica al editar el contrato.

**Alcance.**
- Alta de `contrato_monto` (monto inicial y reajustes), con vigencia en período mensual.
  - Si el contrato **no tiene ninguna fila** (creado en T04 sin monto), el alta registra el
    **primer monto**, con `vigente_desde_periodo` igual al mes de `fecha_inicio`
    (`data-model.md` §5.1, regla 4).
  - Los reajustes posteriores **agregan filas nuevas**; nunca sobrescriben ni eliminan filas
    anteriores del histórico.
- Generación de `pago_esperado` para los períodos del contrato vigente, con el monto y la
  fecha esperada correspondientes.
- Recálculo explícito de `monto_esperado_clp` en los `pago_esperado` afectados por un
  reajuste retroactivo.

**Criterios de aceptación** (de `user-stories.md`, HU02):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E3 — Reajuste sin crear un contrato nuevo | El contrato conserva identidad, arrendatario y garantía; el monto vigente cambia desde el mes del reajuste |
| AC2 | E4 — Un mes anterior conserva el monto que regía | El pago esperado de un mes anterior a un reajuste refleja el monto de entonces, no el vigente hoy |
| AC3 | E5 — Reajuste con vigencia retroactiva | Los pagos esperados de los meses comprendidos se actualizan al nuevo monto y su estado se recalcula |
| AC4 | CL15 — Mes sin contrato vigente | Sin contrato vigente no existe pago esperado, y su ausencia no es impago |

**Entidades involucradas:** `contrato_monto`, `pago_esperado` (`data-model.md` §4.7, §4.8).

**Componentes y capas arquitectónicas:**
- Servicios: generación idempotente de `pago_esperado` antes de operar sobre los pagos de
  un período; recálculo explícito tras un reajuste retroactivo (`architecture.md` §5.4).
- Dominio: función pura de "monto vigente del contrato en un mes" sobre las filas de
  `contrato_monto` (`architecture.md` §5, §10.1).
- API: Route Handler de reajuste, expuesto como una sola operación de producto aunque
  internamente escriba en `contrato_monto` y recalcule `pago_esperado` — el ejemplo que
  `architecture.md` §8.3 usa literalmente.
- Persistencia: `UNIQUE(contrato_id, vigente_desde_periodo)` en `contrato_monto`;
  `UNIQUE(contrato_id, periodo)` en `pago_esperado`.

**Dependencias:** T04 (`contrato_id`).

**Fuera de alcance:** registro de abonos y determinación del estado del pago (T06);
prorrateo intramensual de un reajuste (fuera de alcance por decisión de modelo,
`data-model.md` §4.7).

**Estrategia de pruebas:**
- Unitario de dominio: monto vigente para un período dado un conjunto de filas de
  `contrato_monto`, incluida vigencia retroactiva.
- Integración de servicios: AC1–AC4 completos, incluida la invariante de que
  `monto_esperado_clp` coincide siempre con el monto que da `contrato_monto` para su
  período (`data-model.md` §5.1).
- Nivel prioritario de la pirámide de `architecture.md` §18: los casos límite de HU02 se
  traducen directamente a tablas de casos.

**Estado de implementación (T05, cambio OpenSpec `implement-rent-adjustments`).**
Implementado y verificado con `npm test` (144 pruebas, 0 fallidas), TypeScript y lint sin
errores, y revisión manual de la interfaz.
- *Primer monto y reajustes:* `POST /api/propiedades/{id}/contratos/{contratoId}/montos`
  agrega una fila a `contrato_monto`; nunca modifica ni elimina las anteriores. Sin filas,
  el primer monto rige desde el mes de `fecha_inicio`. Período fuera de la vigencia del
  contrato (anterior al inicio o posterior al término) → 422; período repetido → 409.
  `GET` del mismo path devuelve el historial y el monto vigente (solo lectura).
- *Pagos esperados ya existentes:* el reajuste actualiza `monto_esperado_clp` (y su
  `updated_at`) únicamente desde su período, calculando cada pago sobre todas las filas, de
  modo que un reajuste anterior no pisa a uno posterior. Los meses anteriores conservan su
  monto. No crea pagos.
- *Generación de pagos esperados:* operación explícita
  `POST .../pagos-esperados/sincronizar`, idempotente (`UNIQUE(contrato_id, periodo)` +
  bloqueo por propiedad). Crea los pagos faltantes desde el mes de inicio —solo si hay un
  monto registrado— hasta `min(mes en curso, mes de término)`; nunca modifica ni borra pagos
  existentes. Ningún `GET` escribe y no hay cron. *Desviación frente a `architecture.md`
  §5.4* (generar «antes de operar sobre los pagos de un período»): T05 expone la
  sincronización como acción explícita; T06 podrá invocarla antes de registrar un abono sin
  cambiar su contrato.
- *Edición de contrato (T04):* el PUT responde 409 solo si acortar `fecha_termino` deja
  fuera de vigencia un monto o un pago esperado ya registrado; las demás ediciones válidas
  no se bloquean.
- *Interfaz:* `/propiedades/[id]/contratos/[contratoId]/montos` (historial, monto vigente,
  primer monto o reajuste, sincronizar pagos), enlazada desde la lista de contratos.
- *Alcance:* el AC3 se cumple en lo que T05 posee, el **monto esperado**. El **estado** del
  pago no se calcula ni se persiste: es derivado y depende de los abonos (T06).

**Comportamiento previsto de los reajustes cuando T06 registre abonos** (diseñado, no
implementado): el reajuste solo cambia `monto_esperado_clp`; nunca modifica, elimina ni
reasigna abonos. *Actualización (`gestion-montos-arriendo`):* un reajuste que cambiaría el esperado
de un pago con abonos se rechaza (422), ver el estado de T05 más abajo; las reglas de estado
siguientes siguen valiendo para la derivación. El estado se deriva al consultar
(`data-model.md` §6.1): un pago pagado cuyo esperado sube pasa a *vencido con abonos
parciales* si su fecha esperada ya pasó (CL12) o a *parcialmente pagado* si no (CL13); si el
esperado baja, los abonos excedentes se admiten (CL14). T05 no persiste estado, saldo ni
exceso. Fuera de T05 quedan los abonos y pagos recibidos (T06) y los movimientos financieros
(T07).

---

**Estado de implementación (T05, ampliación `gestion-montos-arriendo`).** Corrección y
eliminación guardada de montos: `PUT` y `DELETE .../montos/{montoId}`. La regla común, aplicada
también a `registrarMonto` (alta de reajuste): una operación solo procede si **ningún pago
esperado cuyo monto cambiaría tiene abonos**; si lo tiene, 422 sin cambios parciales. Los pagos
con abonos cuyo monto no cambia no bloquean; los períodos anteriores a la vigencia de la fila no
se tocan; el monto inicial no se elimina; los abonos nunca se modifican. Todo se ejecuta bajo el
bloqueo por propiedad que también toma el registro de abonos. **Pendiente de decisión de negocio:**
corregir montos de períodos con abonos (p. ej. aplicar solo hacia adelante o ajuste compensatorio).

### 4.6 T06 — Registro de abonos y estado del pago de arriendo

**Tipo:** backend · **Historia de usuario:** HU02

**Objetivo.** Registrar uno o varios abonos contra un pago esperado y derivar su estado
—cuatro estados excluyentes más las dos calificaciones— sin persistir ninguno de los dos.

**Contexto funcional.** Es el ticket que resuelve el problema central del producto: un
pago pagado a medias o vencido no tenía representación explícita en ninguna parte
(`product.md` §1). El estado se determina por precedencia a partir del monto esperado, los
abonos y la fecha esperada (`data-model.md` §6.1); *vencido con abonos parciales* y
*pagado con atraso* son calificaciones derivadas, nunca un quinto o sexto estado.

**Alcance.**
- Alta de uno o varios `abono_arriendo` contra un `pago_esperado`, sin tope sobre el monto
  esperado.
- Dominio puro que deriva: monto recibido, saldo pendiente, estado (`PENDIENTE` ·
  `PARCIALMENTE_PAGADO` · `VENCIDO` · `PAGADO`), fecha de completitud y las dos
  calificaciones, con la fecha de referencia inyectada, nunca leída del reloj del sistema.

**Criterios de aceptación** (de `user-stories.md`, HU02):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E6/E7 — Uno o varios abonos cubren el pago | Un abono o la suma de varios que alcanza el esperado deja el pago en `PAGADO` |
| AC2 | E8/E9/E10 — Pendiente, parcial y vencido | Sin abonos y sin vencer → `PENDIENTE`; parcial sin vencer → `PARCIALMENTE_PAGADO`; sin abonos y vencido → `VENCIDO` |
| AC3 | CL11 — Vencido con abonos parciales | Un pago con abonos parciales cuya fecha ya pasó queda `VENCIDO`, indicando su total recibido y su saldo pendiente |
| AC4 | CL12/CL13 — El reajuste descubre un pago | Un reajuste retroactivo que eleva el monto esperado deja el pago `VENCIDO` con parciales si su fecha ya pasó, o `PARCIALMENTE_PAGADO` si no ha vencido — misma precedencia, sin tratamiento especial |
| AC5 | CL14 — Los abonos exceden el monto esperado | Abonos que superan el esperado dejan el monto cubierto y el pago `PAGADO` |

**Entidades involucradas:** `abono_arriendo` (`data-model.md` §4.9); lee `pago_esperado`
(T05).

**Componentes y capas arquitectónicas:**
- Dominio: precedencia de los cuatro estados, fecha de completitud —con el desempate
  técnico entre abonos del mismo día— y las dos calificaciones, como funciones puras con
  la fecha inyectada (`architecture.md` §5.1, §5.2; `data-model.md` §6.1).
- API: Route Handler de abonos, capacidad "Pagos de arriendo" (`architecture.md` §8.3).
- Persistencia: `abono_arriendo` sin restricción de tope sobre el monto.

**Dependencias:** T05 (`pago_esperado_id`). Ante un reajuste, T06 solo deriva el estado
sobre el `monto_esperado_clp` ya actualizado por T05 (ver «Comportamiento previsto» en T05).

**Fuera de alcance:** cobrar o ejecutar el pago (`product.md` §8); consolidación del
ingreso dentro del flujo del mes (T09); comprobante del abono como documento (T11, no
bloqueante).

**Estrategia de pruebas:**
- Unitario de dominio: tabla de verdad completa de las cuatro reglas de precedencia y las
  dos calificaciones, incluidos AC1–AC5 y el caso de abonos el mismo día (`architecture.md`
  §18, primer nivel de la pirámide).
- Junto con T05, es el candidato más claro para ilustrar "lógica de negocio en servicios
  testeables, sin cálculo financiero en componentes" (`CLAUDE.md`).

**Estado de implementación (T06, cambio OpenSpec `implement-rent-payments`).**
Implementado y verificado: pruebas automatizadas, migración en pruebas y desarrollo, y revisión visual de la interfaz (ver abajo).
- *Abonos:* CRUD bajo `/api/propiedades/{id}/contratos/{cid}/pagos-esperados/{pid}/abonos`
  (`GET`, `POST`) y `.../abonos/{abonoId}` (`PUT`, `DELETE`). Monto <= 0 y fecha de
  recepción futura → 422; formato inválido → 400; cualquier id que no pertenezca a la
  cadena propiedad → contrato → pago → abono → 404. La edición reemplaza monto, fecha y
  medio y no mueve el abono a otro pago. La eliminación es **física**, sin papelera ni
  auditoría (`data-model.md`, «Borrado»), con confirmación en la interfaz.
- *Estado derivado:* `GET .../contratos/{cid}/pagos-esperados` devuelve cada pago con
  recibido, saldo pendiente, estado, fecha de completitud y las dos calificaciones,
  calculados por la función pura `calcularEstadoPago` con «hoy» de Chile inyectado. Nada
  de eso se persiste; no escribe ni sincroniza.
- *Reajustes:* conservan los abonos y se rechazan (422) si cambiarían el esperado de un pago con abonos; el estado se deriva sobre el monto esperado vigente.
- *Interfaz:* `/propiedades/[id]/contratos/[contratoId]/pagos` (listar, registrar, editar
  y eliminar abonos), enlazada desde la lista de contratos y desde montos.
- *Seed:* no se amplió con abonos (decisión del usuario): el seed no crea contratos ni pagos y queda fuera de T06; no aplicable.
- *Migración:* `20261101120000_add_abono_arriendo` (tabla, índices y `CHECK (monto_clp > 0)`).
- *Verificado:* migración `20261101120000_add_abono_arriendo` aplicada a la base de pruebas
  aislada; suite completa con `npm test`: 179 pruebas, 0 fallidas, 0 omitidas (incluye las
  13 de integración de `tests/pagos/pago-service.integration.test.ts`, las 16 de dominio y
  las 6 de esquema y HTTP, y las de T04 y T05 sin regresiones); TypeScript, lint y
  `openspec validate` sin errores. La suite la ejecutó el usuario en su terminal; TypeScript,
  lint y OpenSpec, en esta sesión.
- *Verificación manual (usuario):* migración confirmada también en la base de desarrollo
  `realtytrack`; revisión visual de `/propiedades/[id]/contratos/[contratoId]/pagos`:
  listado de pagos, registro, edición y eliminación con confirmación, con actualización de
  estados y saldos.
- *Limitación:* el 401 de las rutas nuevas lo cubre el `proxy.ts` global para `/api/*`, como
  en T04 y T05; no hay prueba específica por ruta porque `requireSession` solo funciona en
  el runtime de Next.js.

---

---

### 4.7 T07 — Movimientos financieros (egresos e inversiones)

**Tipo:** full-stack · **Historia de usuario:** HU03

**Objetivo.** Registrar por propiedad los egresos e inversiones del mes, categorizados,
sin que el dividendo hipotecario se duplique aquí.

**Contexto funcional.** Un egreso o inversión es uso de recursos de la propiedad
(`product.md` §6.4). No existe categoría `DIVIDENDO`: ese hecho vive en
`credito_registro_mensual` (T03); una categoría homónima aquí duplicaría la misma salida
de dinero.

**Alcance.**
- Alta y consulta de `movimiento_financiero` por propiedad, fecha y categoría
  (`REPARACION`, `EQUIPAMIENTO`, `SEGURO`, `CONTRIBUCIONES`, `GASTO_COMUN`,
  `GASTO_EXTRAORDINARIO`, `OTRO`).
- Registro de gastos comunes durante la vacancia como egreso de la propiedad, sin
  convertirse en un módulo de administración de gastos comunes.

**Criterios de aceptación** (de `user-stories.md`, HU03):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E2 — Egresos diferenciados | Dividendos pagados y otros gastos se presentan por separado, en CLP |
| AC2 | CL13 — Gastos comunes durante la vacancia | Pagados por el propietario en un mes sin arrendatario, figuran como egreso de esa propiedad |

**Entidades involucradas:** `movimiento_financiero` (`data-model.md` §4.10).

**Componentes y capas arquitectónicas:**
- UI: `app/propiedades/[id]/movimientos` (`architecture.md` §7).
- API: Route Handler de movimientos, capacidad "Egresos" (`architecture.md`
  §8.3).
- Persistencia: `categoria_movimiento` como `ENUM` sin `DIVIDENDO` (`data-model.md`
  §4.10).

**Dependencias:** T01 (`propiedad_id`).

**Fuera de alcance:** administración ordinaria de gastos comunes (`product.md` §8);
dividendo hipotecario (T03); agregación mensual y flujo neto (T09).

**Estrategia de pruebas:**
- Integración de servicios: alta por categoría; `DIVIDENDO` no existe como valor válido
  del enum.
- API: 201 en alta válida.

**Estado de implementación (T07, cambio OpenSpec `t07-movimientos-financieros`).**
Implementado y verificado: pruebas automatizadas, build, migración en pruebas y desarrollo, y revisión visual de la interfaz (ver abajo).
- *CRUD:* `GET`, `POST` en `/api/propiedades/{id}/movimientos` y `GET`, `PUT`, `DELETE` en
  `.../movimientos/{movId}`. Formato inválido o categoría fuera del enum (incluida
  `DIVIDENDO`) → 400; monto <= 0 o fecha futura (referencia `hoyChile()`, hoy se acepta) →
  422; propiedad o movimiento que no pertenece a ella → 404. Borrado **físico** con
  confirmación en la interfaz. Sin columna `tipo`.
- *Agregación:* función pura `agregarPorCategoria` (total y 7 categorías, aritmética
  `bigint`) y `rangoDelMes`; `GET` sin `mes` cubre todo el historial y con `?mes=YYYY-MM`
  solo ese mes. `resumenMensual` queda como punto de entrada para T09.
- *Interfaz:* `/propiedades/[id]/movimientos` (filtro mensual, total, desglose, alta,
  edición y eliminación), enlazada desde el detalle de la propiedad.
- *Migración:* `20261109120000_add_movimiento_financiero` (enum, tabla, índice
  `(propiedad_id, fecha)` y `CHECK (monto_clp > 0)`), generada con `prisma migrate diff`
  sin conexión; la aplicó el usuario desde su terminal (ver verificación manual).
- *Verificado en esta sesión:* TypeScript y lint sin errores; 18 pruebas sin base
  (esquema, agregación y 401 de `proxy.ts`) pasan.
- *Verificación manual (usuario):* migración aplicada en `realtytrack_test` y en
  `realtytrack` (declarado por el usuario); revisión visual de
  `/propiedades/[id]/movimientos`: registro, edición, eliminación con confirmación y
  actualización de los datos mostrados.
- *Verificado:* suite completa con `npm test` (ejecutada por el usuario): 199 pruebas,
  199 aprobadas, 0 fallidas, 0 omitidas (sin omisiones, por lo que las de integración de
  `tests/movimientos/movimiento-service.integration.test.ts` —CRUD, pertenencia, filtro
  mensual, no duplicación de dividendos y `CHECK`— se ejecutaron contra la base de pruebas);
  `npm run build` compila y lista las rutas `/api/propiedades/[id]/movimientos`,
  `.../movimientos/[movId]` y `/propiedades/[id]/movimientos`; TypeScript, lint y
  `openspec validate` sin errores.
- *Limitación:* como en T06, el 401 de las rutas nuevas lo cubre el `proxy.ts` global
  (prueba en `tests/auth/proxy.test.ts`); `requireSession` solo funciona en el runtime de
  Next.js.

**Ampliación: desglose opcional en conceptos (cambio OpenSpec `t07-desglose-movimientos`).**
Un movimiento puede ser **simple** (como hasta ahora) o **desglosado** en 1 a 50 conceptos
con nombre (1–100 caracteres, repetidos permitidos) y monto CLP entero > 0. Los conceptos no
son movimientos: el movimiento sigue siendo uno solo.
- *Modelo:* entidad hija `movimiento_concepto` (`data-model.md` §4.14): `id`,
  `movimiento_financiero_id` (`ON DELETE CASCADE`), `nombre`, `monto_clp` (`CHECK > 0`),
  `orden`, timestamps e índice por movimiento. Migración aditiva
  `20261116120000_add_movimiento_concepto`, generada sin conexión; no altera
  `movimiento_financiero` ni modifica filas (sin relleno: los movimientos existentes son
  gastos simples). Un movimiento es desglosado si tiene conceptos; no hay columna que lo marque.
- *Total:* `movimiento_financiero.monto_clp` es el total y la suma de los conceptos; la
  calcula el servidor con `bigint` (`sumarConceptos`, `server/domain/movimiento-desglose.ts`).
  Si el cliente envía `montoClp` con conceptos, debe coincidir (422). La suma no puede exceder
  14 dígitos (422).
- *Validación:* `movimientoInputSchema` (alta) y `movimientoEdicionSchema` (edición).
  `conceptos: null` y los errores de formato → 400 (con claves como `conceptos.0.nombre`);
  montos ≤ 0 o inconsistentes → 422. Los límites de 50 conceptos y 100 caracteres se aplican
  en el esquema Zod.
- *Reglas del `PUT`:* `conceptos` **ausente** conserva el desglose (acepta `montoClp` omitido
  o igual al total vigente; uno distinto → 422 sin modificar nada); **`[]`** convierte en
  simple, exige `montoClp` > 0 y elimina los conceptos de forma atómica; **una lista** reemplaza
  el desglose completo (`$transaction`: borrado y reinserción) y recalcula el total. En un
  simple, omitir `montoClp` es un 400, como antes. Un rechazo (400 o 422) no modifica nada.
- *Compatibilidad:* mismas rutas; la respuesta añade `conceptos` (`[]` en los simples). Los
  clientes anteriores siguen funcionando y no pierden conceptos por omisión.
- *T09 sin cambios:* `dashboard-service` lee solo `monto_clp` del movimiento (sin `include`
  ni JOIN con `movimiento_concepto`), por lo que un gasto desglosado se cuenta una sola vez;
  fórmulas, DTO y consultas intactos.
- *Interfaz:* el mismo `movimientos-panel.tsx`: opción «Desglosar en conceptos», filas
  dinámicas (máximo 50), total en vivo con la función de dominio, aviso al convertir un
  desglosado en simple, conceptos visibles bajo su movimiento en el listado y edición con los
  conceptos precargados.
- *Pruebas:* unitarias (`movimiento-desglose`, esquemas y la guarda estática
  `dashboard-sin-conceptos`), de integración del servicio y de T09 (un desglosado de 150.000 se
  cuenta una vez; editar a 160.000, convertir y eliminar se reflejan; SQL de T09 sin tocar
  `movimiento_concepto`) y HTTP de las rutas con sesión simulada
  (`movimiento-api.integration.test.ts`).
- *Verificado (por el usuario, PostgreSQL local):* migración aplicada en `realtytrack` y
  `realtytrack_test`; pruebas de integración del servicio, HTTP y de T09 aprobadas; suite
  completa (`npm test`) sin fallos; `npm run build` correcto; consulta de integridad
  (`data-model.md` §4.14) con 0 filas inconsistentes en `realtytrack_test`.
- *Revisión visual parcial:* solo se confirmó en el navegador la conversión de un gasto simple
  existente en uno desglosado con tres conceptos y total de 150.000 CLP. Siguen **sin
  confirmar** los demás flujos: alta desglosada, edición de conceptos, desglosado → simple con
  su aviso, errores 400/422, eliminación y límites de la interfaz.

---

### 4.8 T08 — Aportes de capital *(cancelado)*

**Estado: cancelado por decisión de producto.** No forma parte del MVP y no está
implementado. Se conserva la entrada para no renumerar los tickets ni las referencias.

**Qué era.** El registro de `aporte_capital` por propiedad (motivo y vínculo opcional a un
movimiento), con el aporte del mes y el acumulado en el dashboard.

**Por qué se canceló.** Se decidió no llevar un registro independiente de capital aportado:
el gasto de una propiedad se registra una sola vez, como egreso, en T07. T09 conserva sus
cálculos, sin cifra de aportes.

**Historia de la cancelación.** Se llegó a implementar localmente (modelo, servicio, API y
pantalla) sin commit y se retiró antes de integrarse. Las migraciones
`20261114120000_add_aporte_capital` y `20261115120000_drop_aporte_capital` quedan como un par
de alta y retiro sin efecto neto.

**Lo que lo sustituyó (T07).** El gasto se registra una sola vez, como egreso, y se puede
desglosar en conceptos con montos individuales: ver «Ampliación: desglose» en §4.7.

---

### 4.9 T09 — Dashboard financiero mensual

**Tipo:** full-stack · **Historia de usuario:** HU03

**Objetivo.** Consultar el flujo financiero de un mes —ingresos, egresos, flujo neto, saldo
de créditos y estado de los pagos— a nivel de
cartera y de cada propiedad, sin consolidar información a mano.

**Contexto funcional.** Es la respuesta a la pregunta que más trabajo cuesta hoy: qué
ocurrió financieramente en un mes (`product.md` §1). Ingresos y egresos se imputan por su
fecha real de caja, nunca por `periodo` (`data-model.md` §7.1); el estado del pago se
presenta, no se calcula aquí — pertenece a T06 (`user-stories.md`, HU03 "Fuera de
alcance": *"La determinación del estado de un pago de arriendo, que pertenece a HU02. HU03
lo presenta, no lo calcula"*).

**Alcance.**
- Agregación por consulta a PostgreSQL de: ingresos (`fecha_recepcion` de los abonos),
  egresos (`movimiento_financiero.fecha` + `credito_registro_mensual.fecha_pago_dividendo`),
  flujo neto.
- Vista de cartera y vista individual por propiedad, ambas del mismo servicio de
  agregación.
- Saldo de los créditos en UF con equivalente en CLP; estabilidad frente a variaciones
  posteriores de la UF.
- Presentación —no cálculo— del estado de las obligaciones de arriendo del período
  consultado, junto al flujo de caja del mes.

**Criterios de aceptación** (de `user-stories.md`, HU03):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E1 — Ingresos del mes | La suma de los abonos del mes, en CLP |
| AC2 | E3 — Flujo neto | 500.000 de ingresos y 650.000 de egresos dan −150.000 |
| AC3 | E7 — Vista individual por propiedad | Crédito, contrato vigente, pagos y egresos de ese mes |
| AC4 | E9 — Estabilidad frente a variaciones posteriores de la UF | Un mes histórico produce las mismas cifras aunque la UF cambie después |
| AC5 | E11 — Estado de los pagos en el dashboard | Se obtiene el estado de cada pago del mes |
| AC6 | CL12 — Mes sin movimientos | Cifras en cero, incluido el flujo neto en 0 |
| AC7 | CL14 — Agregar no es comparar | El dashboard agrega el conjunto y abre cada propiedad, sin ranking |

**Entidades involucradas:** ninguna propia; lee `abono_arriendo` (T06),
`movimiento_financiero` (T07), `credito_registro_mensual` (T03),
`valor_uf_periodo` (T10), y el estado derivado de `pago_esperado` (T06).

**Componentes y capas arquitectónicas:**
- UI: `app/dashboard/` — vista de cartera y vista por propiedad, rutas dinámicas por
  depender de la fecha actual (`architecture.md` §7.1).
- Servicios: agregación mensual vía `aggregate`/`groupBy` de Prisma, aplicando la regla
  de caja (`architecture.md` §10.1, §10.2, §10.5).
- Persistencia: sin tabla de resumen ni caché (`architecture.md` §10.3).

**Dependencias:** T03 · T06 · T07 · T10.

**Fuera de alcance:** determinación del estado del pago (T06 lo calcula; este ticket lo
presenta); comparación entre propiedades y proyecciones financieras (`product.md` §8).

**Estrategia de pruebas:**
- Integración de servicios: AC1–AC7, con especial atención a que un hecho registrado con
  `fecha_pago_dividendo` en un mes distinto de su `periodo` se agregue en el mes de la
  fecha, no del período (`data-model.md` §7.3).
- Es el ticket que más se apoya en el nivel de integración de la pirámide de
  `architecture.md` §18, porque exige PostgreSQL real para verificar la agregación.

**Estado de implementación (T09, cambio OpenSpec `t09-dashboard-financiero`).**
Implementado y verificado: suite completa, build y revisión manual (ver abajo); sin pruebas HTTP automatizadas de 200 y 404. Sin migraciones ni tablas nuevas.
- *Servicio único:* `dashboardService` (`resumenMensual` de cartera, `resumenPropiedad`).
  Totales por fecha de caja: ingresos por `fecha_recepcion`, dividendos por
  `fecha_pago_dividendo`, otros egresos por `fecha` (T07), aritmética `bigint`. El total de
  cartera es la suma de las filas por propiedad. Una consulta por tabla, sin N+1; el
  agrupado por propiedad se hace en TypeScript (los abonos y dividendos requieren dos saltos
  de relación) y los movimientos se leen como filas porque también alimentan la actividad.
- *Estado de pagos:* pagos esperados del `periodo` contractual del mes, con
  `calcularEstadoPago` de T06 y «hoy» de Chile; cuenta todos los abonos del pago aunque se
  hayan recibido en otro mes.
- *Saldo UF:* último `saldo_pendiente_uf` con `periodo` <= mes consultado (nunca
  posteriores); sin registro se muestra «Sin saldo registrado», no 0.
- *Endpoints:* `GET /api/dashboard?mes=YYYY-MM` y `GET /api/propiedades/{id}/resumen-mensual?mes=`;
  `mes` inválido → 400, propiedad inexistente → 404, sin sesión → 401; sin `mes`, mes actual
  de Chile.
- *Interfaz:* `/dashboard` (selector mensual, flujo del mes, estados de pagos, resumen por
  propiedad en el orden de `propiedadService.listar`, sin ranking) y `/propiedades/[id]`
  con datos → resumen del mes → actividad reciente (abonos, dividendos y movimientos, fecha
  descendente, desempate por origen e id, con enlaces) → accesos. Enlace desde `app/page.tsx`.
- *Gastos desglosados (ampliación de T07, §4.7):* T09 contabiliza cada movimiento con su
  `monto_clp`, que en un gasto desglosado ya es la suma de sus conceptos; no lee ni suma los
  conceptos (sin `include` ni JOIN con `movimiento_concepto`). Sus fórmulas, DTO y consultas
  no cambiaron; solo se añadieron pruebas.
- *Dependencias futuras (resueltas después por T10):* el equivalente en CLP del saldo en UF se
  añadió con T10 sin cambiar estas fórmulas (métodos `resumenMensualConEquivalentes` y
  `resumenPropiedadConEquivalentes`, §4.10). AC4 sigue sin implementarse. Hasta T10 la
  interfaz no mostraba cifras ni ceros para ellos. T08 (aportes de capital) se canceló: el
  flujo neto es simplemente ingresos menos egresos.
- *Verificación (resultados reales):* TypeScript y lint sin errores y `openspec validate`
  válido (ejecutados en la sesión de desarrollo). El usuario confirmó desde su terminal local
  que `npm test` terminó correctamente y que `npm run build` terminó correctamente (el build
  falló antes por `hoyChile()` en prerenderizado y se corrigió leyendo `searchParams` antes).
  Revisión manual satisfactoria de `/dashboard` y `/propiedades/[id]`, incluido el registro,
  edición y eliminación de movimientos: los totales y el resumen se actualizan al volver a
  las vistas sin recarga manual ni cambios adicionales (no hizo falta `router.refresh()` ni
  `revalidatePath`).
- *Limitación de pruebas HTTP:* **no existen pruebas HTTP automatizadas para 200 y 404** de
  `GET /api/dashboard` y `GET /api/propiedades/{id}/resumen-mensual`. Los handlers dependen
  de `auth()`, que solo funciona dentro del runtime de Next.js, y el proyecto no tiene
  patrón de prueba de handlers ni de simulación de sesión; probarlos exigiría refactorizar la
  autenticación o añadir tooling. Cobertura real: 404 en el servicio (`resumenPropiedad`),
  400 (`mes` inválido) y 401 automatizados, y 200 por revisión manual (el usuario probó los endpoints a mano y funcionaron correctamente).
- *Pruebas automatizadas (resultado real de `npm test`, terminal del usuario):* 218 pruebas,
  218 aprobadas, 0 fallidas, 0 canceladas, **0 omitidas**; incluye las 11 de integración de
  `tests/dashboard/dashboard-service.integration.test.ts` contra PostgreSQL real (desfase de
  abono y de dividendo, mes vacío y futuro, aislamiento, cartera = suma de propiedades,
  estados de pago, saldo por período, actividad descendente).

---

**Ampliación T09 (`dashboard-historico-mensual`).** `GET /api/dashboard/historico?mes&meses`
(6 meses por defecto, máximo 12; tres consultas por rango y la misma `totales()` del dashboard
mensual; sin UF). `GET /api/dashboard` añade `saldoConsolidado`: suma exacta en UF de los
últimos saldos aplicables, equivalente en CLP con la UF del mes consultado y estado
`COMPLETO`/`PARCIAL`/`SIN_SALDOS` (un crédito sin saldo no cuenta como 0; un crédito aún no
otorgado en el mes no forma parte del universo). La interfaz suma tabla de histórico, enlaces a
mes anterior/siguiente y el consolidado, sin gráficos.

### 4.10 T10 — Integración con la API de UF

**Tipo:** transversal · **Historia de usuario:** ninguna dedicada (ver nota abajo)

**Objetivo.** Obtener el valor de la UF y conservarlo por período de forma estable, sin
estimar ni interpolar cuando no esté disponible.

**Contexto funcional.** El valor de la UF se obtiene de una API pública chilena; el
sistema no simula ni recalcula esa lógica (`product.md` §7.1). Es la capacidad que
sostiene el criterio de éxito 4 de `product.md` §10: consultar dos veces un mes anterior
produce las mismas cifras aunque la UF haya cambiado entre ambas consultas. No tiene HU
propia: `user-stories.md` no dedica un escenario a "obtener el valor de la UF" porque es
infraestructura consumida por HU01 (E6) y HU03 (E9), no una historia en sí misma.

**Alcance.**
- Puerto `ProveedorUf`: obtener el valor de la UF para una fecha concreta.
- Tabla `valor_uf_periodo`: un valor por período, con `fecha_valor`, `fuente` y momento de
  obtención; no se sobrescribe una vez almacenado.
- Degradación parcial cuando la UF solo aporta un equivalente opcional (implementada);
  error explícito cuando el resultado principal de la operación depende de la UF ausente
  (criterio AC4, **no implementado**: ninguna operación actual lo necesita).

**Dos decisiones que el ticket dejaba abiertas, ya cerradas al implementarlo:**
1. **Proveedor: findic.cl** (`GET https://findic.cl/api/uf/{dd-mm-yyyy}`), sin API key. El
   puerto `ProveedorUf` se mantiene independiente del proveedor HTTP, de modo que sustituirlo
   no obliga a tocar a quien lo consume (`architecture.md` §12.1, V2).
2. **Política del día: día 1 del período**, definida en un único punto del código
   (`fechaReferenciaPeriodo`, `architecture.md` §12.5, V3; `data-model.md` §8.4, D17). Las
   otras dos opciones siguen descartadas por no haber sido elegidas, no por inviables.

**Criterios de aceptación** (derivados de `product.md` y `data-model.md`; no existe un
escenario Gherkin dedicado a esta capacidad en `user-stories.md`):
| # | Regla cerrada | Fuente |
|---|---|---|
| AC1 | Persistencia estable: una vez almacenado el valor de un período, una consulta posterior a la API no lo sobrescribe | `data-model.md` §4.12, §8.3 |
| AC2 | Sin estimación: si la UF de un período no está disponible, se informa; no se interpola ni se arrastra el mes anterior | `product.md` §7.1 |
| AC3 | Degradación parcial: si la UF ausente solo afecta a un equivalente opcional, la operación principal tiene éxito y el equivalente se marca como no disponible | `architecture.md` §12.4 |
| AC4 | Error explícito: si el resultado principal de la operación depende de la UF ausente, falla como dependencia externa, no con una cifra inventada | `architecture.md` §12.4, §17 |

**Entidades involucradas:** `valor_uf_periodo` (`data-model.md` §4.12).

**Componentes y capas arquitectónicas:**
- `server/uf/` — puerto `ProveedorUf` e implementación concreta (`architecture.md`
  §12.1).
- Persistencia: tabla `valor_uf_periodo`, PK `periodo`.
- Tratamiento de errores: AC3 degrada a equivalente `null`; el 503 de AC4 sigue reservado
  (`architecture.md` §17) y no está implementado.

**Dependencias:** ninguna. Es infraestructura que T02, T03 y T09 consumen.

**Fuera de alcance:** cualquier cálculo o estimación de la UF; una serie diaria de UF; la
UF «del día del hecho»; precarga programada.

**Estrategia de pruebas:**
- Unitario: dado un valor ya almacenado, una segunda obtención no lo modifica aunque el
  valor "actual" de la fuente externa haya cambiado (fuente simulada con un doble).
- Unitario: la ausencia de valor produce degradación parcial o error según el caso, nunca
  una estimación.
- Integración: persistencia real de `fecha_valor`, `fuente` y momento de obtención.

**Estado de implementación (T10, cambio OpenSpec `t10-integracion-uf`).**
Implementado y verificado: suite completa, build, verificación contra findic.cl real y
revisión visual (ver abajo), con **una salvedad** documentada. Una migración, sin cambios en
tablas existentes.
- *Proveedor:* `server/uf/findic.ts` consulta `GET {UF_API_BASE_URL}/{dd-mm-yyyy}` (variable
  opcional; por defecto `https://findic.cl/api/uf`) con `fetch` nativo, timeout de 5 s y sin
  caché de Next. Valida con Zod: estado 2xx, JSON, `serie` de un solo elemento, `fecha` igual
  a la solicitada y `valor` numérico finito y positivo; lo convierte de inmediato a
  `Prisma.Decimal` y exige a lo sumo 2 decimales y rango de `NUMERIC(12,2)`. `serie: []` es
  *sin datos* (ausencia legítima); error HTTP, timeout, JSON inválido o valor inválido son
  *error*. El puerto devuelve el resultado, no lanza.
- *Persistencia:* tabla `valor_uf_periodo` (migración `20261118120000_add_valor_uf_periodo`,
  `CHECK` de valor > 0 y de período día 1). Inserción idempotente (`createMany` con
  `skipDuplicates`) seguida de relectura: un valor almacenado no se sobrescribe, tampoco
  ante consultas concurrentes. No se persisten errores ni respuestas vacías.
- *Servicio (`server/uf/uf-service.ts`):* lee primero PostgreSQL y consulta al proveedor solo
  los períodos sin valor, deduplicados y agrupados. **Máximo 6 llamadas HTTP simultáneas** y
  **corte anticipado** dentro de cada invocación: tras 6 fallos consecutivos (error,
  timeout, excepción o respuesta inconsistente) deja de iniciar consultas; las ya iniciadas
  terminan y sus valores válidos se conservan. Una respuesta válida o una serie vacía
  reinician el contador; la serie vacía nunca cuenta como fallo. Sin estado entre solicitudes.
  Los períodos no consultados quedan sin equivalente, nunca estimados.
- *Conversión:* `convertirUfAClp` (sin cambios) sobre `Decimal`; el equivalente es
  `{ valorClp, ufClp, fechaReferencia }` o `null` (`server/uf/equivalente.ts`), calculado en
  el servidor, sin redondear ni persistir; el redondeo a entero es solo de presentación.
- *Período de referencia de cada equivalente:* cuota contractual → mes actual; saldo inicial →
  mes de `fecha_otorgamiento` (si es `null`, equivalente `null` y la interfaz indica «Sin
  fecha de otorgamiento»); último saldo registrado y saldo del registro mensual → su propio
  período; saldo del dashboard → **mes consultado**, conservando el período original del
  saldo (puede ser anterior).
- *Contratos:* campos nuevos opcionales, sin cambiar ni renombrar los existentes.
  `GET /api/propiedades/{id}/credito` añade `cuotaContractualClp`, `saldoInicialClp` y
  `ultimoSaldo`; los GET del registro mensual añaden `equivalenteClp`; `GET /api/dashboard` y
  `GET /api/propiedades/{id}/resumen-mensual` añaden `saldoCredito.equivalenteClp`. Los
  métodos originales de los servicios (incluidos `resumenMensual` y `resumenPropiedad`, que usa
  la ficha de propiedad) no consultan la UF.
- *Degradación:* con UF no disponible o proveedor caído, la operación principal responde 200 y
  el equivalente es `null` («No disponible»). No se implementó `UfNoDisponibleError` ni el
  503 de AC4: ningún flujo actual depende de la UF para su resultado principal. AC4 es un
  criterio **condicional** (aplica a una operación cuyo resultado principal dependa de la UF);
  T10 no entrega ninguna, de modo que no se ejerce y no hay comportamiento que verificar. Se
  conserva como regla para futuras operaciones (`architecture.md` §12.4, §17).
- *Cálculos financieros intactos (T07, T09):* el equivalente se calcula después de los totales
  y no entra en ninguna suma; ingresos, dividendos, otros egresos, flujo neto, estados de pago
  y el conteo único de un gasto desglosado no cambiaron.
- *Interfaz:* crédito con la sección «Valores de UF utilizados» (cada referencia una sola
  vez); registro mensual con el equivalente y su referencia bajo cada saldo; dashboard con el
  equivalente bajo cada saldo y una única referencia bajo la tabla.
- *Pruebas automatizadas:* unitarias del cliente (con `fetch` simulado), de la política del
  día, del equivalente y de su formato, de la concurrencia máxima y del corte anticipado;
  de integración con PostgreSQL de pruebas para el servicio de UF, el crédito, el registro
  mensual y el dashboard (UF disponible, sin datos, proveedor caído, valor ya almacenado,
  histórico estable, contratos anteriores y cálculos financieros idénticos con y sin UF).
- *Verificación (resultados reales, ejecutados por el usuario en su entorno local):*
  `npm test` con 352 pruebas, 0 fallidas y 0 omitidas; TypeScript y ESLint sin errores;
  `npm run build` correcto; `GET /api/uf/01-03-2026` devuelve 39796.31 y `01-01-2030` devuelve
  `serie: []`, y `createFindicProveedor` devolvió `ok` y `sin-datos` respectivamente, sin
  persistir datos. Revisión visual satisfactoria de crédito, registro mensual y dashboard,
  incluidos el proveedor sin datos, el proveedor inaccesible, la persistencia en
  `valor_uf_periodo` y los JSON de los tres GET.
- *Salvedad:* el escenario de crédito **sin `fecha_otorgamiento`** («Sin fecha de
  otorgamiento») tiene cobertura automatizada pero **no se comprobó visualmente**.

---

### 4.11 T11 — Almacenamiento de documentos

**Tipo:** transversal · **Historia de usuario:** ninguna dedicada (ver nota abajo)

**Objetivo.** Almacenar y recuperar los documentos asociados a una propiedad, un crédito,
un contrato o un abono, guardando en PostgreSQL solo la metadata.

**Contexto funcional.** Saber que se pagó una reparación y encontrar la factura de esa
reparación son hoy dos búsquedas distintas (`product.md` §1); este ticket las une.
PostgreSQL nunca guarda binarios (`CLAUDE.md`, `data-model.md` §4.13). No tiene HU propia:
es la misma capacidad genérica que HU01 (E9) y HU02 (E18) ejercen sobre hechos distintos.

**Alcance.**
- Puerto `AlmacenDocumentos` contra la API de S3: URL firmada de subida, URL firmada de
  lectura, borrado.
- Entidad `documento`: `propiedad_id` obligatorio; `credito_id`, `contrato_id`,
  `abono_arriendo_id` opcionales y excluyentes entre sí.
- Subida directa desde el navegador al bucket, sin que el binario atraviese el runtime de
  la aplicación.

**Criterios de aceptación** (E9 de HU01 y E18 de HU02 se verifican aquí, porque ambos
ejercen la misma capacidad genérica sobre hechos distintos):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | HU01 E9 — Documentos de la propiedad y del crédito | Al adjuntar los documentos de la propiedad y el contrato hipotecario, quedan localizables partiendo de la propiedad |
| AC2 | HU02 E18 — Documentos contractuales | Al adjuntar el contrato firmado y sus anexos, quedan localizables desde el contrato y desde su propiedad |
| AC3 | Derivado de `data-model.md` §4.13 y criterio de éxito 9 | Cualquier documento se localiza partiendo de su propiedad con una sola consulta, sea cual sea su vínculo específico |

**Entidades involucradas:** `documento` (`data-model.md` §4.13).

**Componentes y capas arquitectónicas:**
- `server/storage/` — puerto `AlmacenDocumentos` (`architecture.md` §13.1).
- API: Route Handlers de URL de subida, registro de metadata, listado y URL de lectura.
- Persistencia: `documento`, `CHECK` de exclusividad entre las tres FK específicas.

**Dependencias — en el sentido correcto: este ticket depende de las entidades a las que
asocia documentos, no ellas de él:**

| Necesita | Para qué | ¿Bloqueante? |
|---|---|---|
| T01 (`propiedad`) | `propiedad_id` obligatorio en toda fila | Sí, para cualquier documento |
| T02 (`credito_hipotecario`) | Vínculo `credito_id` (AC1) | Solo para ese vínculo |
| T04 (`contrato_arriendo`) | Vínculo `contrato_id` (AC2) | Solo para ese vínculo |
| T06 (`abono_arriendo`) | Vínculo `abono_arriendo_id` (comprobante de pago) | Solo para ese vínculo |

El puerto genérico —URL firmada, borrado, la tabla `documento` con `propiedad_id`— se
construye y prueba en cuanto existe una propiedad (T01), independientemente de T02, T04 y
T06. **T02 y T04 no dependen de este ticket**: pueden completarse sin que exista todavía.

**Fuera de alcance:** interpretación del contenido de los documentos —OCR, extracción con
IA— (`product.md` §8).

El modelo admite además un vínculo opcional a `movimiento_financiero`
(`data-model.md` §4.13); este ticket no lo excluye, simplemente ningún criterio de
aceptación de HU03 lo ejercita, así que no forma parte de sus AC1–AC3.

**Estrategia de pruebas:**
- Integración: el `CHECK` de exclusividad rechaza un documento con dos vínculos
  específicos a la vez.
- Integración: localizar todos los documentos de una propiedad con una sola consulta
  (AC3).
- API: la URL de subida es de vida corta y el bucket no expone objetos públicamente.

**Estado de implementación (T11, cambio OpenSpec `t11-gestion-documentos`).** Implementado y
validado contra Cloudflare R2 real: subida, descarga y eliminación física (ver README,
«Configuración de documentos»). Migración `20261123120000_add_documento` (no aplicada en este repositorio).
- *Puerto y proveedor:* `AlmacenDocumentos` (URL firmada de subida y lectura, inspección, lectura
  de los primeros bytes, borrado) con implementación S3-compatible (R2 como objetivo) que firma
  con SigV4 usando solo `node:crypto`, verificada con el vector oficial de AWS. Pruebas con un
  almacén simulado; sin servicios externos.
- *Flujo:* `POST .../documentos/subida` (valida tipo, formato y tamaño; devuelve URL PUT de 5 min
  con `Content-Type` y `Content-Length` firmados, clave `propiedades/{id}/{uuid}` y un
  `tokenSubida`) → el navegador sube directo al bucket → `POST .../documentos` (exige el token;
  el servidor comprueba existencia, tamaño, `Content-Type` y firma de formato del objeto real, y
  descarta el que no cumple) → `GET` (listado y URL de lectura de 5 min) y `DELETE`.
- *Reglas confirmadas:* PDF, JPEG, PNG y WebP; máximo 20 MB; bucket privado; vínculos a
  propiedad, crédito, contrato, abono o movimiento, que deben pertenecer a la propiedad.
- *Inconsistencias:* un objeto huérfano se acepta (`architecture.md` §13.3); sin metadata que
  apunte a un archivo inexistente; almacenamiento no configurado o caído → 503.
- *Interfaz:* `/propiedades/{id}/documentos` (lista, subida, descarga, eliminación con
  confirmación; vínculo a propiedad, crédito o contrato).

---

### 4.12 T12 — Acceso protegido de usuario único

**Tipo:** transversal · **Historia de usuario:** ninguna

**Objetivo.** Proteger toda la aplicación detrás de email y contraseña de un único
usuario, sin registro público, invitaciones ni perfiles.

**Contexto funcional.** `user-stories.md` es explícito: *"Acceso protegido de usuario
único (product.md §6.7, §7.2). Forma parte del MVP pero no está entre las tres historias
documentadas."* Por eso este ticket deriva sus criterios directamente de `product.md`, no
de un escenario de HU.

**Alcance.**
- Auth.js con proveedor de credenciales y estrategia JWT; hash de contraseña con
  Argon2id.
- Middleware que protege todas las rutas salvo la pantalla de acceso.
- Alta del usuario único por seed; sin endpoint de registro.

**Criterios de aceptación** (derivados de `product.md` §6.7 y §7.2; no existe HU de la que
derivarlos):
| # | Regla | Fuente |
|---|---|---|
| AC1 | Con el usuario único creado por seed, email y contraseña correctos dan acceso a la aplicación | `product.md` §6.7 |
| AC2 | Sin sesión, cualquier ruta distinta del acceso redirige a la pantalla de acceso | `architecture.md` §11.1 |
| AC3 | No existe flujo de registro público, invitación ni gestión de perfiles | `product.md` §6.7, §7.2 |

**Entidades involucradas:** `usuario` (`data-model.md` §4.1).

**Componentes y capas arquitectónicas:**
- `auth/` — Auth.js, middleware (`architecture.md` §11.1).
- Persistencia: tabla `usuario`, sin `usuario_id` en ninguna entidad de dominio.

**Dependencias:** ninguna. Es un prerrequisito transversal de los otros once: cada uno
puede construirse y probarse antes de que este exista, pero ninguno debe exponerse en
producción sin él.

**Fuera de alcance:** registro público, invitaciones, perfiles, roles, recuperación de
contraseña (`product.md` §6.7; `architecture.md` §11.1); multiusuario y cartera compartida
(`product.md` §8).

**Estrategia de pruebas:**
- Integración: acceso con credenciales correctas e incorrectas.
- API: toda ruta protegida devuelve 401 sin sesión.

---

## 5. Mapa de cobertura

| Capacidad de `product.md` §5 | Tickets |
|---|---|
| 1. Gestión de propiedades | T01 |
| 2. Gestión de créditos hipotecarios | T02, T03 |
| 3. Gestión de contratos y arriendos | T04, T05 |
| 4. Registro y control de pagos, ingresos y gastos | T06 (pagos) · T07 (gastos) |
| 5. Dashboard financiero e histórico mensual | T09 |
| Transversal: almacenamiento de documentos | T11 |
| Transversal: acceso protegido | T12 |
| *(sin numeral en §5, exigida por §7.1 y por dos historias)* | T10 (UF) |

Los 11 tickets vigentes (T08 se canceló) cubren exactamente lo que `product.md` §5 exige. T10 no tiene numeral
propio porque es infraestructura transversal a dos capacidades, no una capacidad de
negocio en sí misma — igual que `architecture.md` la trata como un puerto.

## 6. Dependencias — vista completa

```
T12 (auth)         — prerrequisito transversal, sin bloquear a nadie
T10 (UF)           — sin dependencias (implementado; sus dos decisiones internas están cerradas: findic.cl y día 1)

T01 (propiedades)
 ├─→ T02 (crédito) ──→ T03 (registro mensual) ─────────────┐
 ├─→ T04 (contrato) ─→ T05 (reajustes/pago esperado) ─→ T06 (abonos/estado) ─┐
 ├─→ T07 (movimientos) ───────────────────────────────────┤                │
                                                            ▼                ▼
                                                        T09 (dashboard) ←────┘
                          (T09 también depende de T10)

 ├─→ T11 (documentos) — depende de T01 siempre; opcionalmente de T02/T04/T06
 │                       para cada vínculo específico (no bloqueante entre sí)

T02 depende además de T10 (UF, para el equivalente en CLP)
```

`T11` depende de las entidades a las que asocia documentos, no al revés: T02 y T04 pueden
completarse sin que T11 exista todavía.

## 7. Nota sobre `readme.md` §6

La plantilla exigirá, al integrar el README, uno de backend, uno de frontend y uno de
base de datos. Esa selección **queda pendiente para la tarea de integración del README**
y no se resuelve aquí. Como referencia, sin comprometerla: T06 (backend, motor de reglas
puro con precedencia), T09 (full-stack; si se elige, solo su capa de presentación
ilustraría el frontend) y T03 (esquema con más restricciones: dos `CHECK`, `UNIQUE`
compuesto, separación `periodo`/`fecha_pago_dividendo`) son puntos de partida razonables.
Los 11 tickets vigentes permanecen íntegros en este backlog sin importar qué se seleccione después.

## 8. Referencias

- [product.md](product.md) — problema, alcance, funcionalidades y reglas de negocio
- [user-stories.md](user-stories.md) — HU01, HU02 y HU03 con sus criterios de aceptación
- [data-model.md](data-model.md) — entidades, restricciones y reglas de derivación
- [architecture.md](architecture.md) — componentes, capas y decisiones técnicas
- `CLAUDE.md` — contexto del proyecto, stack y reglas de trabajo
