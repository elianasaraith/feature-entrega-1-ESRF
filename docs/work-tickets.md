# RealtyTrack — Tickets de trabajo

## 1. Propósito y alcance

Este documento es el **backlog técnico completo** del MVP: la unidad de trabajo entre el
diseño ya cerrado (`product.md`, `user-stories.md`, `data-model.md`, `architecture.md`) y
la implementación.

> **Todo lo descrito aquí es backlog propuesto, no implementado.** Entrega 1 es
> exclusivamente documental: no hay código de aplicación. Cada ticket describe trabajo
> por hacer en las entregas siguientes.

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
| T08 | Aportes de capital | full-stack | HU03 | T01 |
| T09 | Dashboard financiero mensual | full-stack | HU03 | T03 · T06 · T07 · T08 · T10 |
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
contrato queda sin fila y la invariante «al menos una fila» se relaja hasta T05
(*propuesta a validar*). Reajustes, nuevas filas y el cálculo del monto vigente son T05.

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

---

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

**Dependencias:** T05 (`pago_esperado_id`).

**Fuera de alcance:** cobrar o ejecutar el pago (`product.md` §8); consolidación del
ingreso dentro del flujo del mes (T09); comprobante del abono como documento (T11, no
bloqueante).

**Estrategia de pruebas:**
- Unitario de dominio: tabla de verdad completa de las cuatro reglas de precedencia y las
  dos calificaciones, incluidos AC1–AC5 y el caso de abonos el mismo día (`architecture.md`
  §18, primer nivel de la pirámide).
- Junto con T05, es el candidato más claro para ilustrar "lógica de negocio en servicios
  testeables, sin cálculo financiero en componentes" (`CLAUDE.md`).

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
- API: Route Handler de movimientos, capacidad "Egresos y aportes" (`architecture.md`
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

---

### 4.8 T08 — Aportes de capital

**Tipo:** full-stack · **Historia de usuario:** HU03

**Objetivo.** Registrar el capital propio incorporado a una propiedad como concepto
separado del egreso o inversión que financia, sin que lo sustituya ni lo elimine.

**Contexto funcional.** Aporte y uso de fondos son conceptos distintos (`product.md` §6.4,
§7.1). El aporte no se cuenta como egreso del mes: tratarlo así duplicaría la salida de
dinero y borraría el resultado real del período.

**Alcance.**
- Alta de `aporte_capital` por propiedad, con motivo (`PIE_INICIAL`, `CAPITAL_ADICIONAL`,
  `COBERTURA_DEFICIT`, `OTRO`).
- Vínculo opcional al `movimiento_financiero` que ese aporte financia, sin efecto en
  ningún cálculo.

**Criterios de aceptación** (de `user-stories.md`, HU03):
| # | Escenario | Resumen |
|---|---|---|
| AC1 | E4 — El aporte no neutraliza el resultado | El flujo neto antes de aportes se mantiene; el aporte figura como cifra separada |
| AC2 | E5 — Inversión financiada con capital propio | El egreso y el aporte figuran por separado, sin que ninguno sustituya al otro |
| AC3 | E6 — Aportes del mes y acumulados | Se obtiene el aporte del mes y el acumulado histórico |

**Entidades involucradas:** `aporte_capital` (`data-model.md` §4.11).

**Componentes y capas arquitectónicas:**
- UI: `app/propiedades/[id]/aportes` (`architecture.md` §7).
- API: Route Handler de aportes, capacidad "Egresos y aportes" (`architecture.md` §8.3).
- Persistencia: FK opcional `movimiento_financiero_id`, sin efecto en el flujo neto
  (`data-model.md` §4.11).

**Dependencias:** T01 (`propiedad_id`). Reutiliza opcionalmente T07 (FK nulable, no
bloqueante).

**Fuera de alcance:** agregación del aporte del mes y acumulado en el dashboard (T09
consume este registro, no lo genera).

**Estrategia de pruebas:**
- Integración de servicios: alta con y sin vínculo a `movimiento_financiero`; el vínculo
  se guarda sin participar en ningún cálculo de este ticket.

---

### 4.9 T09 — Dashboard financiero mensual

**Tipo:** full-stack · **Historia de usuario:** HU03

**Objetivo.** Consultar el flujo financiero de un mes —ingresos, egresos, flujo neto antes
de aportes, aportes acumulados, saldo de créditos y estado de los pagos— a nivel de
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
  flujo neto antes de aportes, aportes del mes y acumulados.
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
| AC2 | E3 — Flujo neto antes de aportes | 500.000 de ingresos y 650.000 de egresos dan −150.000 |
| AC3 | E7 — Vista individual por propiedad | Crédito, contrato vigente, pagos, egresos y aportes de ese mes |
| AC4 | E9 — Estabilidad frente a variaciones posteriores de la UF | Un mes histórico produce las mismas cifras aunque la UF cambie después |
| AC5 | E11 — Estado de los pagos en el dashboard | Se obtiene el estado de cada pago del mes |
| AC6 | CL12 — Mes sin movimientos | Cifras en cero, incluido el flujo neto en 0 |
| AC7 | CL14 — Agregar no es comparar | El dashboard agrega el conjunto y abre cada propiedad, sin ranking |

**Entidades involucradas:** ninguna propia; lee `abono_arriendo` (T06),
`movimiento_financiero` (T07), `aporte_capital` (T08), `credito_registro_mensual` (T03),
`valor_uf_periodo` (T10), y el estado derivado de `pago_esperado` (T06).

**Componentes y capas arquitectónicas:**
- UI: `app/dashboard/` — vista de cartera y vista por propiedad, rutas dinámicas por
  depender de la fecha actual (`architecture.md` §7.1).
- Servicios: agregación mensual vía `aggregate`/`groupBy` de Prisma, aplicando la regla
  de caja (`architecture.md` §10.1, §10.2, §10.5).
- Persistencia: sin tabla de resumen ni caché (`architecture.md` §10.3).

**Dependencias:** T03 · T06 · T07 · T08 · T10.

**Fuera de alcance:** determinación del estado del pago (T06 lo calcula; este ticket lo
presenta); comparación entre propiedades y proyecciones financieras (`product.md` §8).

**Estrategia de pruebas:**
- Integración de servicios: AC1–AC7, con especial atención a que un hecho registrado con
  `fecha_pago_dividendo` en un mes distinto de su `periodo` se agregue en el mes de la
  fecha, no del período (`data-model.md` §7.3).
- Es el ticket que más se apoya en el nivel de integración de la pirámide de
  `architecture.md` §18, porque exige PostgreSQL real para verificar la agregación.

---

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
- Degradación parcial cuando la UF solo aporta un equivalente opcional; error explícito
  cuando el resultado principal de la operación depende de la UF ausente.

**Dos decisiones que este ticket deja explícitamente abiertas, y no debe cerrar por su
cuenta:**
1. **Proveedor o API pública concreta.** *Propuesta a validar* en `architecture.md` §12.1
   y §21.3 (V2). El puerto existe precisamente para que la implementación sea
   intercambiable sin tocar a quien lo consume.
2. **Política del día o valor representativo de `valor_uf_periodo`.** *Propuesta a
   validar* en `data-model.md` §8.4: día 1 del período, último día del mes, o el día del
   hecho convertido. Afecta directamente al resultado financiero, así que este ticket la
   deja como parámetro configurable de la implementación (`architecture.md` §12.5), no
   como una decisión tomada aquí.

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
- Tratamiento de errores: 503 reservado a AC4, nunca a AC3 (`architecture.md` §17).

**Dependencias:** ninguna. Es infraestructura que T02 y T09 consumen.

**Fuera de alcance:** elegir el proveedor concreto y la política del día representativo
(son las dos decisiones abiertas de este mismo ticket); cualquier cálculo o estimación de
la UF.

**Estrategia de pruebas:**
- Unitario: dado un valor ya almacenado, una segunda obtención no lo modifica aunque el
  valor "actual" de la fuente externa haya cambiado (fuente simulada con un doble).
- Unitario: la ausencia de valor produce degradación parcial o error según el caso, nunca
  una estimación.
- Integración: persistencia real de `fecha_valor`, `fuente` y momento de obtención.

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
| 4. Registro y control de pagos, ingresos y gastos | T06 (pagos) · T07, T08 (ingresos/gastos) |
| 5. Dashboard financiero e histórico mensual | T09 |
| Transversal: almacenamiento de documentos | T11 |
| Transversal: acceso protegido | T12 |
| *(sin numeral en §5, exigida por §7.1 y por dos historias)* | T10 (UF) |

Los 12 tickets cubren exactamente lo que `product.md` §5 exige. T10 no tiene numeral
propio porque es infraestructura transversal a dos capacidades, no una capacidad de
negocio en sí misma — igual que `architecture.md` la trata como un puerto.

## 6. Dependencias — vista completa

```
T12 (auth)         — prerrequisito transversal, sin bloquear a nadie
T10 (UF)           — sin dependencias (dos decisiones internas siguen abiertas)

T01 (propiedades)
 ├─→ T02 (crédito) ──→ T03 (registro mensual) ─────────────┐
 ├─→ T04 (contrato) ─→ T05 (reajustes/pago esperado) ─→ T06 (abonos/estado) ─┐
 ├─→ T07 (movimientos) ───────────────────────────────────┤                │
 └─→ T08 (aportes) ───────────────────────────────────────┤                │
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
Los 12 tickets permanecen íntegros en este backlog sin importar qué se seleccione después.

## 8. Referencias

- [product.md](product.md) — problema, alcance, funcionalidades y reglas de negocio
- [user-stories.md](user-stories.md) — HU01, HU02 y HU03 con sus criterios de aceptación
- [data-model.md](data-model.md) — entidades, restricciones y reglas de derivación
- [architecture.md](architecture.md) — componentes, capas y decisiones técnicas
- `CLAUDE.md` — contexto del proyecto, stack y reglas de trabajo
