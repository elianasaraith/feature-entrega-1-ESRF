> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Esperamos un máximo de 3 por sección, principalmente los de creación inicial o  los de corrección o adición de funcionalidades que consideres más relevantes.
Puedes añadir adicionalmente la conversación completa como link o archivo adjunto si así lo consideras


## Índice

1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## Herramientas, modelos y contexto avanzado

**Herramientas.**

| Herramienta | Uso en RealtyTrack |
|---|---|
| Claude Code (extensión de VS Code) | Asistente de código en todas las fases: documentación, desarrollo de T01–T07 y T09–T12 (T08 se exploró, se implementó localmente y se canceló), ampliaciones, rediseño, seguridad, E2E, seed de demostración y cierre documental |
| OpenSpec | Flujo Spec-Driven Development: 14 especificaciones en `openspec/specs/`, 21 cambios archivados en `openspec/changes/archive/` y ninguno activo. En el cierre, `openspec validate --all --strict` dio 14 de 14 |
| Playwright (Chromium) | Cinco escenarios E2E (`e2e/`); ejecutados con éxito en local por la persona, en dos ejecuciones consecutivas con 5 de 5 en ambas |
| Vercel, Neon y Cloudflare R2 | Despliegue de producción, PostgreSQL y documentos de la demo. La persona confirma el despliegue, las migraciones, el seed y las pruebas en producción; en la sesión de cierre la IA no accedió a Neon ni a R2 |
| Comandos y skills del repositorio | `.claude/commands/opsx/` (explore, propose, apply, verify, archive…) y `.claude/skills/` (skills `openspec-*`) |

**Modelos.** Claude, a través de Claude Code. En las sesiones de T05, de T08 y la ampliación de
T07 (desglose), de T10 y de auditoría y cierre documental final, el modelo fue **Claude Sonnet
5.5**, según lo informa Claude Code. El modelo de las demás sesiones no quedó registrado en el
repositorio y no se afirma aquí.

**Subagentes.** Revisor documental (consistencia de la API, §4); revisión de seguridad
independiente y de solo lectura (§2.5); tres subagentes por módulos en el rediseño (solo uno
completó su trabajo, §6); y un subagente de solo lectura para la auditoría final de entrega (W9).

**Contexto avanzado (respaldado por el repositorio).**

- `CLAUDE.md`: contexto del proyecto, stack confirmado, reglas confirmadas del dominio,
  fuera de alcance y reglas de trabajo (consultar antes de cambiar, no inventar
  requisitos, anonimizar datos, registrar prompts).
- Skill `project-documentation` (`.claude/skills/project-documentation/`): procedimiento
  para redactar y mantener coherentes `docs/`, `readme.md` y `prompts.md`.
- `docs/` como fuente de verdad que precede al código: producto, historias, modelo de
  datos, arquitectura y tickets (T01–T12).
- Flujo Spec-Driven Development con OpenSpec: *explore → propose* (proposal, delta de
  especificación, diseño, tareas) *→ apply → verify → archive*; el archivo del cambio
  conserva proposal, diseño, especificación y tareas verificadas.

## Workflows representativos

Nueve workflows concentran el uso de IA; el detalle de los prompts está en las secciones
indicadas.

| # | Workflow | Qué demuestra | Dónde |
|---|---|---|---|
| W1 | Documentación spec-first (Entrega 1): producto → historias → modelo → arquitectura → tickets → README | IA para diseñar y documentar antes de programar, con correcciones de las propuestas | Secciones 1–6 |
| W2 | Autenticación y propiedades (T12, T01) con OpenSpec | Restricciones de seguridad y de pruebas dadas a la IA antes de implementar | Sección 6, registro de implementación |
| W3 | Créditos y registro mensual (T02, T03) | Aislamiento de la base de pruebas comprobado por componentes, no por texto | Sección 6, registro de implementación |
| W4 | Contratos (T04) | Migraciones escritas por la IA y aplicadas solo con verificación y autorización | Sección 6, registro de implementación |
| W5 | Montos, reajustes y pagos esperados (T05): explore → plan → propose → apply → verify → archive | Ciclo completo con el plan corregido por la persona, validación manual y archivo | Sección 6, registro de implementación, y abajo |
| W6 | Cancelación y retirada de T08 (aportes de capital) | Una decisión de producto aplicada sin perder el historial: se retiró solo el código de T08, se conservó la migración histórica, la persona aplicó la migración de retiro y el change no se archivó como implementado | Sección 6, decisiones de T08 |
| W7 | Ampliación de T07 con desglose de conceptos: explore → propose → corrección del `PUT` → apply por etapas → verify | Diseño corregido antes de implementar por una precondición de la persona; seis etapas con detención al final de cada una, migración aplicada por la persona y verificación sin marcar como ejecutado lo que no corrió | Sección 6, decisiones del desglose |
| W8 | Integración de la UF (T10): explore → propose → ajustes de la persona → apply por grupos con detención y verificación local entre cada uno | Alcance acotado por etapas; una exploración que fundó decisiones de producto aprobadas por la persona; la IA no marcó como verificado lo que su sandbox no pudo ejecutar (PostgreSQL, findic.cl, navegador) | Sección 6, decisiones de T10 |
| W9 | Auditoría y cierre documental final: auditoría de solo lectura con un subagente → plan mínimo → aprobación con restricciones → ajustes, archivado y validación estricta | La IA no implementa hasta la aprobación y documenta solo resultados confirmados | Abajo |

**W5 en detalle (hechos del desarrollo de T05).** Se pidió explorar T05 sin modificar
archivos; la IA presentó un plan, la persona **lo rechazó con seis ajustes** (interfaz
obligatoria, reajustes que solo actualizan montos desde su período, sincronización
explícita en lugar de escrituras silenciosas desde un `GET`, alcance mínimo, documentar el
comportamiento futuro con abonos y verificar la migración) y la IA lo reescribió antes de
generar los artefactos OpenSpec. Después se implementó, se verificó contra los artefactos
(`/opsx:verify`), se validó manualmente en la interfaz y se archivó (`/opsx:archive`).

**Etapas finales (resumen respaldado por el repositorio y por lo confirmado por la persona; no
son citas).**

| Etapa | Qué se hizo | Evidencia |
|---|---|---|
| Seguridad (`seguridad-mvp`) | Auditoría con subagente y endurecimiento; prompts en la sección 2.5 | Change archivado; commit `ab2aa34`; `docs/architecture.md` §11 |
| Pruebas E2E (`pruebas-e2e-mvp`) | Flujo principal ampliado a cinco escenarios y corregido tras la primera ejecución local; la persona confirmó que los cinco finalizaron correctamente; change archivado en el cierre | `e2e/`; commit `ab2aa34`; spec `e2e-testing` |
| Seed de demostración | Datos ficticios, repetible, con guarda del host de destino; la persona lo ejecutó (3 propiedades, 6 meses, 17 abonos) | `prisma/seed-demo.ts`; commit `60b4fb8` |
| Despliegue | Vercel, Neon (17 migraciones aplicadas) y un bucket R2 de demo; la persona validó en producción la carga de documentos y la edición de registros | <https://realtytrack.vercel.app>; confirmación de la persona |

**W9 — prompts de la auditoría y del cierre (fragmentos literales).**

> «Realiza una auditoría final de RealtyTrack orientada al cumplimiento de los requisitos de entrega del máster AI4Devs.» · «Utiliza un subagente de revisión documental de solo lectura para reducir el consumo de contexto.» · «No inventes evidencias, modelos utilizados ni resultados de pruebas.» · «Espera mi aprobación antes de implementar cualquier ajuste.»
>
> «Documenta exclusivamente los resultados reales proporcionados.» · «No marques retroactivamente tareas de cambios ya archivados sin evidencia suficiente.»

*Resultado:* el enunciado oficial del máster no está en el repositorio, por lo que la auditoría
se apoyó en la plantilla de `readme.md` y `prompts.md`. En el cierre definitivo, la persona
confirmó que sus pruebas locales finalizaron satisfactoriamente y pidió documentar solo lo
respaldado por evidencia: «No inventes cifras ni resultados. No vuelvas a ejecutar las pruebas».
La IA contrastó el reporte de Playwright y los códigos de salida de los registros locales de npm,
sin volver a ejecutar nada (`readme.md` §2.6). La persona confirmó después que pasaron todas las pruebas
de `npm test`, que ambas ejecuciones E2E dieron 5 de 5 y que el build compiló; no se dispone del conteo
exacto de pruebas unitarias y de integración.

## Decisiones humanas relevantes

| Decisión | Evidencia |
|---|---|
| **Control del alcance del MVP**: la persona acota cada cambio y prohíbe adelantar tickets («No implementes T05 ni T06», «No implementes abonos… T06 o T07») | Prompts de T04 y T05 (sección 6) |
| **Corrección de propuestas de la IA**: se rechazó dividir el backlog en tickets T13/T14 por capa; se rechazó el plan v1 de T05 | Sección 6, Prompt 2; W5 |
| **Revisión y aprobación de migraciones**: la IA solo escribe el SQL; se verifica su contenido y la base de destino, y se aplica primero a `realtytrack_test` y a desarrollo solo con autorización explícita; las migraciones las aplica la persona | Prompts de T04 y T05; `tasks.md` del cambio archivado `implement-rent-adjustments` (tarea 1.3); prompts de T08 y de la ampliación de T07 (sección 6) |
| **Aislamiento de la base de pruebas**: las pruebas de integración solo escriben en `TEST_DATABASE_URL`, distinta de `DATABASE_URL`/`DIRECT_URL`, comparando host, puerto, base y schema | Prompts de T01 y T03; `tests/setup/test-db.ts` |
| **Validación manual de funcionalidades**: la persona verificó en la interfaz el primer monto, el 409 por período repetido y el 422 por período fuera de vigencia antes de cerrar la tarea 5.4 | `tasks.md` archivado de `implement-rent-adjustments` |
| **Decisión de producto sobre una regla técnica**: aceptar el 409 del PUT de contratos solo cuando acortar el término deje fuera montos o pagos existentes | Prompt de T05 |
| **Decisión de producto sobre el alcance**: cancelar T08 (aportes de capital), conservar el gasto como egreso único y ampliar T07 con un desglose opcional | Prompts de retirada de T08 y de ampliación de T07 (sección 6); `docs/product.md` §6.4 |
| **Protección de datos antes de implementar**: la persona pidió comprobar que el `PUT` no elimine los conceptos cuando se omiten; el diseño aprobado no lo garantizaba, se corrigió y se confirmó la opción A | Prompt de la ampliación de T07 (sección 6); `docs/data-model.md` D16 |
| **Veracidad de la verificación**: se prohibió marcar como ejecutadas las pruebas que no pudieron correr y las visuales sin abrir la aplicación; la revisión visual del desglose consta como parcial | Prompts de las etapas 4 y 5 del desglose; `docs/work-tickets.md` §4.7 |
| **Decisiones de producto y de diseño de T10**: proveedor findic.cl, día 1 como referencia, puerto independiente, sin estimar ni reutilizar períodos, `Decimal` en las conversiones; referencia temporal propia de cada equivalente (saldo inicial con `fechaOtorgamiento`, saldo del dashboard con el mes consultado) | Prompts de T10 (sección 6); `docs/work-tickets.md` §4.10 |
| **Recorte de infraestructura sin consumidores**: la persona pidió no implementar `UfNoDisponibleError` ni el 503; el criterio AC4 quedó documentado, no implementado | Prompt de ajuste de T10; `docs/architecture.md` §12.4 |
| **Control de latencia con el proveedor caído**: la persona fijó el máximo de 6 llamadas simultáneas y aprobó, con reglas explícitas, un corte anticipado tras 6 fallos consecutivos (la serie vacía no cuenta como fallo) | Prompts de los grupos 6 de T10; `docs/architecture.md` §12.3 |
| **Seguridad previa al despliegue público**: la persona exigió no dar por resuelta la integridad de la promoción de objetos en R2 sin garantía demostrable, no usar un audit filtrado como evidencia de ausencia de vulnerabilidades, no aplicar migraciones y separar lo comprobado de lo pendiente por limitaciones del sandbox | Prompt 3 de la sección 2.5; `docs/architecture.md` §11.3–11.5 y §13.2 |
| **Prueba E2E (entrega final)**: la persona acotó el flujo (login, propiedad, contrato, pago, dashboard, cierre de sesión), exigió PostgreSQL real, base de pruebas aislada, tolerancia al límite de intentos de login, selectores accesibles, sin esperas artificiales y solo la dependencia `@playwright/test`; se archivó `seguridad-mvp` antes; tras pasar las dos primeras pruebas, la persona amplió a cinco escenarios (hipoteca, finanzas, arriendos) exigiendo independencia, fechas deterministas, sin API de UF ni R2 y sin archivar hasta confirmar su ejecución local (confirmada después) | Change `pruebas-e2e-mvp`; `e2e/`; `readme.md` 2.6 |
| **Despliegue y cierre**: la persona desplegó, aplicó las migraciones, ejecutó el seed, probó en producción, decidió entregar las credenciales por separado, documentar el PR #1 sin crear otro, conservar el vídeo como evidencia de la entrega anterior y dejar las mejoras opcionales fuera del alcance | W9; `readme.md` 0.4 y 7 |
| **Veracidad de la verificación de T10**: la persona exigió no afirmar ejecuciones sin evidencia del contador `skipped`, no asumir que una fecha futura carece de UF sin comprobar la respuesta real del proveedor, y registrar como salvedad que el crédito sin `fechaOtorgamiento` no se comprobó visualmente | Prompts de los grupos 7 a 9 de T10; `docs/work-tickets.md` §4.10 |

---

## 1. Descripción general del producto

**Prompt 1:**

> Vamos a integrar ahora la documentación de la Entrega 1 en el readme.md oficial.
>
> Objetivo: completar el README como documento integrador de la Entrega 1, sin convertirlo en una copia íntegra de los documentos de docs/.
>
> Reglas:
>
> * Entrega 1 es exclusivamente documental. No afirmes que existe código, infraestructura desplegada, tests ejecutados, seguridad implementada, UI funcional ni endpoints implementados.
> * Usa expresiones como arquitectura propuesta, estructura prevista, estrategia de pruebas prevista y despliegue previsto cuando corresponda.
> * No inventes funcionalidades ni decisiones nuevas.
> * Los documentos de docs/ siguen siendo las fuentes detalladas; el README debe resumirlos y enlazarlos.
> * No modifiques los documentos fuente en esta tarea.
> * Mantén Mermaid donde aporte valor, pero evita duplicar diagramas innecesariamente.
>
> Para 1.3 Diseño y experiencia de usuario, dado que todavía no existe UI implementada, documenta el flujo de experiencia objetivo sin inventar capturas. Puedes proponer un Mermaid sencillo de navegación si aporta claridad.
>
> Para 1.4 Instalación, deja claro que todavía no existe una aplicación ejecutable en Entrega 1 y que las instrucciones concretas se completarán después de la implementación. Puedes resumir el stack objetivo, pero no inventes comandos no verificados.

*El resto de este mismo prompt fija instrucciones para las secciones 2–7 del README; los fragmentos correspondientes se citan en cada sección respectiva de este documento, sin repetir aquí las reglas generales ya mostradas arriba.*

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

**Prompt 1:**

> elimina los diagramas que agregaste a los archivos y haz esto mejor
>
> Quiero agregar fuentes de diagramas versionables para la Entrega 1.
>
> Crea la carpeta docs/diagrams/ y únicamente estos tres archivos Mermaid:
>
> * architecture.mmd: diagrama principal de componentes basado estrictamente en docs/architecture.md.
> * data-model.mmd: ERD completo basado estrictamente en docs/data-model.md.
> * financial-flow.mmd: diagrama conceptual que muestre la diferencia entre período de origen y mes de caja para arriendos y dividendos hipotecarios.
>
> Los diagramas deben ser consistentes con los documentos existentes y no introducir entidades, componentes ni reglas nuevas.
>
> Reutiliza conceptualmente los Mermaid que ya existen cuando corresponda; no diseñes una segunda arquitectura o un segundo modelo.
>
> No modifiques todavía otros documentos.
>
> Antes de crear los archivos, muéstrame un plan breve indicando qué contendrá cada diagrama.

**Prompt 2:**

> El plan está aprobado, con una corrección:
>
> No declares que los diagramas "deben" vivir únicamente como archivos .mmd. Los .mmd serán las fuentes versionables de referencia, pero los documentos pueden conservar diagramas Mermaid incrustados cuando mejoren la lectura.
>
> En esta tarea:
>
> * revierte únicamente los dos diagramas extra que añadiste recientemente a data-model.md;
> * conserva los diagramas ya aprobados en data-model.md y architecture.md;
> * crea docs/diagrams/architecture.mmd, data-model.mmd y financial-flow.mmd;
> * añade en la cabecera de cada .mmd que es la fuente versionable del diagrama correspondiente y que debe mantenerse consistente con el documento.
>
> No intentes resolver ahora la duplicación existente ni reestructures los documentos.

### **2.2. Descripción de componentes principales:**

**Prompt 1:**

> Vamos a continuar con la cadena documental de RealtyTrack.
>
> Antes de hacer cualquier cambio, utiliza la skill project-documentation y lee obligatoriamente:
>
> * CLAUDE.md
> * docs/product.md
> * docs/user-stories.md
> * docs/data-model.md
>
> El siguiente artefacto es docs/architecture.md.
>
> Todavía NO escribas el archivo.
>
> Primero analiza los documentos existentes y propón un plan detallado para la arquitectura del MVP.
>
> Objetivo
>
> Diseñar una arquitectura simple, mantenible y suficiente para RealtyTrack, evitando sobreingeniería y manteniendo trazabilidad con las decisiones funcionales y de datos ya documentadas.
>
> La arquitectura debe cubrir como mínimo: arquitectura general de la aplicación; frontend y backend; responsabilidades principales por capa/módulo; persistencia con PostgreSQL; acceso a datos; autenticación; integración con la API pública de UF; almacenamiento de documentos; estrategia para los cálculos financieros derivados; despliegue; variables de entorno y secretos; tratamiento de errores; estrategia de testing a nivel arquitectónico; diagrama Mermaid; decisiones técnicas y alternativas descartadas.
>
> Stack objetivo
>
> Parte de este stack como dirección actual: Next.js, TypeScript, PostgreSQL, Prisma, Tailwind CSS, Vercel, Neon.
>
> No cambies el stack ni agregues infraestructura importante sin justificarla y marcarla como propuesta a validar.
>
> Restricciones
>
> RealtyTrack es un MVP de usuario único. No propongas microservicios, CQRS, event sourcing, Redis, Kafka, SQS, Kubernetes, múltiples bases de datos ni infraestructura distribuida salvo que exista una necesidad demostrable en los documentos actuales. No agregues funcionalidades que estén fuera del alcance definido en product.md. No diseñes una tabla de amortización hipotecaria ni lógica que intente reproducir los cálculos del banco. No dupliques los dividendos hipotecarios como movimientos financieros. Respeta la separación ya definida entre período de origen y fecha real de caja. Los estados de pago, fecha de completitud, flujo mensual, equivalentes UF → CLP y demás datos definidos como derivados en data-model.md deben continuar siendo derivados; la arquitectura no debe introducir persistencia duplicada de estos resultados. Los documentos no deben almacenarse como binarios en PostgreSQL. La carga histórica inicial será controlada y anonimizada; no diseñes un importador Excel como funcionalidad del producto.
>
> Decisiones que todavía NO debes inventar
>
> Si para completar la arquitectura necesitas decidir algo que los documentos no han cerrado —por ejemplo proveedor concreto de object storage, mecanismo concreto de autenticación o API exacta de UF— identifícalo como propuesta a validar. En particular, no cierres por tu cuenta la regla pendiente sobre qué día de UF representa cada período.
>
> Al terminar, presenta únicamente el plan de docs/architecture.md, incluyendo las decisiones o preguntas que necesiten mi aprobación. No crees ni modifiques todavía docs/architecture.md.

**Prompt 2:**

*Fragmento de un mensaje de corrección que también ajustó §6 y §11 de architecture.md — ver esos mismos puntos en 2.3 y 2.5.*

> architecture.md está aprobado conceptualmente. Haz únicamente estas tres correcciones antes de cerrarlo:
>
> 1. En §8.3 elimina la idea de que los recursos REST estén alineados uno a uno con las entidades de data-model.md. La API debe diseñarse por casos de uso/capacidades del producto, no como CRUD de tablas. Las entidades orientan los datos necesarios, pero no obligan a exponer un recurso por entidad.

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Prompt 1:**

*Mismo mensaje de corrección citado en 2.2 (punto 2 de 3).*

> 2. En §6 corrige la afirmación de que la carpeta server/ impide "por construcción" el acceso desde cliente. La carpeta es una convención; los módulos exclusivamente server-side deben proteger su boundary explícitamente, por ejemplo mediante server-only cuando corresponda.

### **2.4. Infraestructura y despliegue**

*Sin prompt distintivo propio para esta fase: quedó cubierta por el prompt inicial de 2.2, sin una corrección puntual separada.* *El despliegue real (Vercel, Neon y Cloudflare R2) lo ejecutó y verificó la persona; se resume en «Etapas finales» y no se conservan prompts literales de él.*

### **2.5. Seguridad**

**Prompt 1:**

*Mismo mensaje de corrección citado en 2.2 y 2.3 (punto 3 de 3).*

> 3. En §11 evita comprometer el documento con detalles internos de "rotación" de Auth.js. Di simplemente que Auth.js gestiona la creación, protección y lectura de la sesión y su cookie, manteniendo como decisiones explícitas Credentials + JWT + cookie httpOnly/Secure/SameSite + Argon2id.

**Prompt 2 (auditoría previa al despliegue público, modo exploración de OpenSpec, solo lectura):**

> Utiliza un subagente especializado en seguridad para realizar una revisión independiente y de solo lectura. […] Revisa: autenticación y sesiones, API y base de datos, almacenamiento Cloudflare R2, secretos y configuración, dependencias y frontend. […] Distingue entre vulnerabilidades confirmadas mediante evidencia, riesgos potenciales pendientes de verificar y mejoras recomendables que no bloquean la entrega. […] Considera que Vercel utiliza una arquitectura serverless: no propongas mecanismos de rate limiting exclusivamente en memoria. […] Solo diagnóstico. No modificar archivos, no instalar dependencias, no exponer secretos.

*Resultado:* informe con hallazgos S-01…S-15; la persona revisó después las dependencias de Prisma por separado (no *downgrade*, no *overrides*, no migrar a Prisma 7/8).

**Prompt 3 (implementación del change `seguridad-mvp`, `/opsx:propose` → `/opsx:apply`):**

> Garantizar que el objeto definitivo corresponde al contenido validado, incluso ante escrituras concurrentes. Si R2 no permite garantizarlo mediante el mecanismo propuesto, no darlo por resuelto. […] Conservar Prisma 6.19.3 y documentar las vulnerabilidades residuales. No presentar un audit filtrado como prueba de ausencia de vulnerabilidades. […] No aplicar migraciones a ninguna base de datos. […] Ejecuta las verificaciones disponibles y distingue claramente entre resultados comprobados y verificaciones pendientes por limitaciones del sandbox. […] Detente antes de `/opsx:verify`.

*Resultado:* una prueba unitaria expuso un fallo de diseño (el cubo de emails inexistentes permitía enumerar por tiempos) y se corrigió con paridad de coste; la revisión independiente posterior de los cambios se documenta en `docs/architecture.md` §11.

### **2.6. Tests**

*La estrategia de testing se definió dentro del prompt inicial de 2.2. El siguiente prompt corresponde a la implementación de las pruebas de integración de T01.*

**Prompt 1:**

*Fragmento del mensaje de implementación de T01 (seguridad de datos en las pruebas).*

> 6. Seguridad de datos: no modificar ni eliminar las 3 propiedades existentes. No ejecutar TRUNCATE. No ejecutar el seed completo. No ejecutar pruebas de integración contra la base de desarrollo por defecto. Las pruebas de integración deben requerir TEST_DATABASE_URL explícita y utilizar una BD de pruebas independiente. Las pruebas solo pueden eliminar sus propios datos.

*Los dos prompts siguientes corresponden al ticket T02 (Gestión de créditos hipotecarios) y se registran aquí, junto al de T01, porque fijan su estrategia de pruebas; la sección 6 ya alcanzó el máximo de tres prompts.*

**Prompt 2:**

*Fragmento del mensaje que aprobó el plan de T02 y fijó las precisiones sobre pruebas, conversión UF→CLP y códigos HTTP.*

> 1. Mantener la conversión UF→CLP como función pura, utilizando valores fijos únicamente en pruebas. La interfaz debe mostrar «No disponible» hasta implementar T10. El AC3 quedará pendiente de integración.
> 3. PUT debe actualizar únicamente créditos existentes. Si la propiedad no tiene crédito, debe devolver 404. POST debe devolver 409 si ya existe un crédito asociado.
> 5. Las pruebas de integración deben ejecutarse exclusivamente con TEST_DATABASE_URL, sin modificar ni eliminar datos de la BD de desarrollo.

**Prompt 3:**

*Fragmento del mensaje que autorizó `/opsx:apply` de T02 y fijó las reglas de seguridad de datos para pruebas y migración.*

> 4. Mantén TEST_DATABASE_URL como requisito obligatorio para las pruebas de integración. No permitas que utilicen DATABASE_URL como alternativa.
> 5. Genera la migración de Prisma, pero antes de aplicarla a la BD de desarrollo quiero revisar el SQL generado. No elimines ni modifiques los registros existentes de propiedades.

---

## 3. Modelo de Datos

**Prompt 1:**

> Usa la skill project-documentation.
>
> Quiero diseñar únicamente: docs/data-model.md
>
> Antes de proponer el modelo: 1. Lee CLAUDE.md. 2. Lee docs/product.md. 3. Lee docs/user-stories.md. 4. Lee la sección 3 de readme.md. 5. No diseñes arquitectura de componentes, endpoints ni código.
>
> Objetivo
>
> Diseñar el modelo de datos lógico del MVP de RealtyTrack, con suficiente detalle para: representar correctamente las reglas del dominio; soportar las tres historias de usuario documentadas; mantener histórico mensual; conservar UF y CLP correctamente; evitar sobreingeniería.
>
> Decisiones funcionales que el modelo debe soportar
>
> Propiedades: N propiedades; estacionamiento y bodega opcionales; una propiedad puede existir sin crédito hipotecario.
>
> Créditos: crédito asociado opcionalmente a una propiedad; cuota contractual y saldo pendiente en UF; dividendo efectivamente pagado en CLP; histórico mensual de dividendo y saldo; el sistema no calcula amortización.
>
> Arriendos: contratos sucesivos para una misma propiedad; un contrato conserva su identidad aunque cambie el monto; debe existir histórico de reajustes; puede haber períodos sin contrato vigente.
>
> Pagos de arriendo: el sistema genera un pago esperado mensual a partir del contrato; el pago esperado conserva el monto correspondiente al mes; puede recibir uno o varios abonos; el total recibido se deriva de los abonos; el estado se deriva del monto esperado, suma de abonos y fecha esperada; los estados principales son pendiente, parcialmente pagado, pagado, vencido; "vencido con abonos parciales" es una calificación del estado vencido, no un quinto estado; un reajuste retroactivo puede modificar el monto esperado histórico y recalcular el estado.
>
> Finanzas: ingresos de arriendo; dividendos pagados; otros egresos/inversiones; aportes de capital como concepto separado; un aporte no sustituye ni elimina el egreso/inversión que financia; el flujo neto antes de aportes se calcula a partir de ingresos y egresos.
>
> UF: el valor de UF debe poder asociarse a un período mensual; las consultas históricas no deben cambiar únicamente porque la UF cambie después; no existe cierre mensual ni inmutabilidad del período.
>
> Documentos: los documentos pueden estar relacionados con propiedad, crédito, contrato o pago; PostgreSQL guarda metadata, no binarios.
>
> Antes de crear el archivo
>
> Primero propón: 1. entidades candidatas; 2. relaciones y cardinalidades; 3. qué datos deben persistirse y cuáles deben derivarse; 4. qué históricos requieren entidad/registro propio; 5. decisiones que puedan resolverse de más de una forma; 6. riesgos de sobreingeniería.
>
> No crees todavía docs/data-model.md hasta revisar esas decisiones. Evita diseñar tablas solo porque "podrían ser útiles".
>
> No modifiques: docs/product.md; docs/user-stories.md; readme.md; prompts.md; CLAUDE.md.
>
> No diseñes todavía: endpoints; servicios; componentes; infraestructura; tickets.

**Prompt 2:**

> El plan aún contiene las reglas anteriores y no incorpora el feedback aprobado. No crees docs/data-model.md todavía. Corrige específicamente estas secciones:
>
> 1. En §C elimina dividendos pagados por periodo. El flujo de caja debe usar fecha_pago_dividendo. credito_registro_mensual.periodo solo identifica la mensualidad hipotecaria a la que corresponde el dividendo.
> 2. Elimina la frase que dice que fecha_pago_dividendo es informativa. Es un dato funcional necesario para imputar el egreso al flujo de caja.
> 3. Formaliza el estado del arriendo: recibido >= esperado → PAGADO; incompleto + vencido → VENCIDO; parcial + no vencido → PARCIALMENTE_PAGADO; sin abonos + no vencido → PENDIENTE; PAGADO completado después de fecha_esperada → calificación derivada pagado con atraso; VENCIDO con abonos → calificación derivada vencido con abonos parciales.
> 4. Documenta explícitamente la referencia temporal derivada: un abono recibido en abril asociado al pago_esperado.periodo = marzo debe permitir mostrar automáticamente Correspondiente a marzo 2026. No almacenar esa frase manualmente.
> 5. En credito_registro_mensual, permitir saldo, dividendo o ambos, pero no ambos nulos. Si existe dividendo_pagado_clp, debe existir fecha_pago_dividendo.
> 6. En documento, reemplaza pago_esperado_id por abono_arriendo_id para que un comprobante de transferencia respalde el hecho de pago real. El pago_esperado sigue accesible transitivamente desde el abono.
> 7. En UF, mantener fecha_valor, pero la elección del día concreto de referencia debe seguir marcada como propuesta a validar; no fijar todavía obligatoriamente día 1.
>
> Después de aplicar estos cambios, muestra solo las secciones modificadas del plan para revisión, no vuelvas a imprimir el plan completo.

**Prompt 3:**

> Revisa docs/data-model.md con estos ajustes puntuales:
>
> 1. En §8.4 corrige la afirmación de que el esquema admite las tres alternativas de selección de UF sin modificación. Día 1 y último día son compatibles con valor_uf_periodo; "día del hecho convertido" requeriría evolucionar el modelo a valores diarios o UF asociada al hecho.
> 2. En §6.1 aclara que fecha_completitud representa el día en que el acumulado alcanza el esperado. Si hay varios abonos el mismo día, el orden técnico entre ellos solo hace determinístico el cálculo; funcionalmente la fecha sigue siendo ese mismo día.
> 3. Revisa si contrato_arriendo.fecha_termino debe ser obligatoria según las reglas de producto. Si todo contrato del MVP tiene fecha de término conocida, mantenla NOT NULL. Si puede existir contrato vigente sin término definido, propón NULL y adapta la derivación de vigencia. No cambies esto sin validarlo conmigo.
> 4. No hagas otros cambios estructurales. Después muéstrame únicamente el diff conceptual de estas secciones.

---

### 4. Especificación de la API

**Prompt 1:**

*Fragmento del mismo prompt de integración del README citado en la sección 1.*

> Para la sección 4 API, no escribas todavía endpoints ni OpenAPI. Analiza los documentos y propón primero cuáles serían los 3 endpoints más representativos para documentar, explicando por qué cada uno merece estar en el README. No tomes todavía la decisión por tu cuenta.

**Prompt 2:**

*Fragmento de un mensaje de corrección de consistencia que también ajustó contenido de las secciones 1 y 6 del README (no reproducido aquí porque no es específico de la API).*

> 1. En GET /api/dashboard, corrige la inconsistencia del parámetro periodo: el contrato externo debe usar YYYY-MM como indica el endpoint. Usa un string con patrón mensual y ejemplo 2026-03, no format: date ni 2026-03-01.
> 2. En POST /api/contratos/{contratoId}/reajustes, no fijes 409 para vigente_desde_periodo anterior al inicio del contrato salvo que esa decisión HTTP esté explícitamente documentada en las fuentes. Si no lo está, intégralo en 400 como entrada/período inválido o márcalo claramente como contrato API propuesto.
> 5. En los ejemplos de API, no mezcles líneas POST ..., GET ..., // Request o // Response dentro de bloques marcados como json. Separa método/ruta del cuerpo JSON para que los ejemplos sean sintácticamente correctos.

**Prompt 3:**

*Fragmento de la aplicación del hallazgo BLOQUEANTE de una auditoría posterior (subagente reviewer sobre readme.md vs. docs/).*

> Corrige el hallazgo BLOQUEANTE respetando architecture.md §9.1:
>
> * todos los importes monetarios/Decimal que crucen JSON en los tres contratos API deben representarse como string;
> * actualiza tanto los schemas OpenAPI como los ejemplos;
> * aplica esto a importes CLP y UF;
> * no conviertas otros campos que no correspondan a valores Decimal/monetarios;
> * conserva fechas, IDs, estados, arrays y demás tipos actuales.

---

### 5. Historias de Usuario

**Prompt 1:**

*Fragmento del mismo prompt de integración del README citado en la sección 1.*

> Para la sección 5 utiliza las tres historias existentes:
>
> * HU01
> * HU02
> * HU03
>
> Resúmelas para el README y referencia docs/user-stories.md para el detalle.

---

### 6. Tickets de Trabajo

*Este primer prompt refleja la interpretación inicial de que el límite de tres tickets aplicaba también al backlog detallado de docs/work-tickets.md. Esa interpretación fue corregida en un mensaje posterior (no transcrito por el límite de tres prompts), que distingue el backlog técnico completo de los tres trabajos representativos que exige el README.*

**Prompt 1:**

> Vamos con el siguiente artefacto de la Entrega 1: docs/work-tickets.md.
>
> Antes de proponer cambios, lee obligatoriamente: CLAUDE.md; .claude/skills/project-documentation/SKILL.md; docs/product.md; docs/user-stories.md; docs/data-model.md; docs/architecture.md.
>
> Revisa también readme.md únicamente para verificar qué exige la plantilla oficial respecto de los tickets.
>
> Quiero máximo 3 tickets, alineados con las 3 historias principales ya documentadas. No inventes nuevas funcionalidades ni amplíes el MVP.
>
> Como punto de partida, evalúa si la división más coherente es: 1. Gestión de propiedades y créditos hipotecarios — principalmente HU01. 2. Gestión de contratos de arriendo, pagos esperados y abonos — principalmente HU02. 3. Gestión financiera y dashboard mensual — principalmente HU03.
>
> No asumas que esa división es correcta: contrástala contra arquitectura y modelo de datos y propón otra solamente si existe una razón concreta.
>
> Cada ticket debe ser suficientemente implementable por un desarrollador y contener, como mínimo: objetivo; contexto funcional; alcance; historia(s) de usuario relacionada(s); criterios de aceptación verificables; entidades involucradas; componentes/capas arquitectónicas involucradas; dependencias con otros tickets; fuera de alcance; estrategia de pruebas relevante.
>
> Los criterios de aceptación deben derivarse de user-stories.md; no copies todos los criterios de las HU ni inventes reglas nuevas.
>
> Presta especial atención a las reglas que ya cerramos: no persistir datos derivados; separar período de obligación y fecha de caja; dividendo imputado por fecha_pago_dividendo; arriendo imputado por fecha_recepcion; cuatro estados de pago y las calificaciones derivadas; reajustes retroactivos; aportes de capital separados del flujo neto; UF histórica estable según valor_uf_periodo; documentos asociados a los hechos correspondientes; usuario único y acceso protegido; carga histórica inicial no es funcionalidad del producto.
>
> Los tickets deben describir trabajo funcional vertical, no convertirse en tickets técnicos separados como "crear base de datos", "configurar Prisma" o "crear frontend". La infraestructura necesaria debe formar parte del ticket funcional que la necesita.
>
> Antes de escribir docs/work-tickets.md, muéstrame únicamente el plan propuesto con: 1. los 3 tickets; 2. objetivo de cada uno; 3. alcance principal; 4. HU y entidades que cubre cada uno; 5. dependencias entre ellos; 6. cualquier decisión que todavía necesite mi confirmación.
>
> No modifiques archivos todavía.

**Prompt 2:**

*Este prompt llegó después de que yo propusiera T13 y T14 como tickets nuevos, aislados por capa, para resolver la exigencia del README — propuesta que este mensaje rechaza explícitamente.*

> Hay una contradicción en la propuesta T13/T14.
>
> docs/work-tickets.md establece como criterio del backlog que los tickets son rebanadas verticales y que ninguno es una capa técnica aislada. T13, al ser únicamente frontend, y T14, al ser únicamente database, contradicen directamente ese criterio.
>
> Además, tal como están propuestos, duplican responsabilidades que T09 y T03 siguen poseyendo.
>
> No quiero reestructurar T03/T09 solamente para satisfacer la clasificación solicitada por el README.
>
> Por lo tanto:
>
> * No agregues T13 ni T14 a docs/work-tickets.md.
> * Mantén T01–T12 intactos.
> * En la sección 6 del README documenta tres trabajos representativos, indicando transparentemente su procedencia:
>     * Backend: T06 — Registro de abonos y estado del pago de arriendo.
>     * Frontend: implementación de la interfaz del dashboard mensual, correspondiente a la capa frontend de T09.
>     * Base de datos: persistencia e invariantes del registro mensual hipotecario, correspondiente a la capa de base de datos de T03.
> * No reclasifiques T09 ni T03; ambos continúan siendo full-stack en docs/work-tickets.md.
> * En el README explica brevemente que el backlog técnico utiliza principalmente vertical slices y que, para cumplir la plantilla, se seleccionan trabajos representativos de las capas solicitadas.
>
> Mantén todos los demás puntos del plan actual.
>
> Actualiza únicamente el plan. No edites todavía los archivos.

**Prompt 3:**

*Implementación posterior, con OpenSpec, de T01 (Gestión de propiedades) y T03 (Registro mensual de dividendo y saldo del crédito, cuya capa de base de datos ilustra el «Ticket 3» del README): fragmentos de los mensajes que aprobaron cada plan y fijaron sus precisiones. Los criterios de T03 se verificaron con pruebas unitarias, pruebas de integración contra una BD de pruebas aislada y una verificación manual en la interfaz.*

**T01 — precisiones de autenticación, pruebas de integración y validaciones:**

> 1. Autenticación: las rutas /api/* sin sesión deben responder 401 JSON. Las páginas protegidas deben seguir redirigiendo a /login. No alterar /api/auth/*. Mantener requireSession() en los Route Handlers.
> 2. Pruebas de integración: no modificar ni eliminar las 3 propiedades existentes. No ejecutar TRUNCATE ni el seed completo. Las pruebas deben crear y limpiar exclusivamente sus propios registros. Preferir una BD de pruebas aislada si resulta sencillo.
> 3. Validaciones: utilizar Zod con reglas específicas para Propiedad. Validar fechas calendario reales, no solo YYYY-MM-DD. Respetar los tipos y restricciones de Prisma/PostgreSQL. Evitar abstracciones genéricas innecesarias.

**T03 — ajustes al plan (fecha de pago, último saldo y seguridad de pruebas):**

> 1. Fecha de pago:
>    - Si existe dividendo_pagado_clp, fecha_pago_dividendo es obligatoria.
>    - Si dividendo_pagado_clp es null, fecha_pago_dividendo también debe ser null.
>    - Reflejar esta regla en validaciones, especificaciones y restricciones de base de datos.
>
> 2. Último saldo:
>    - Utilizar el registro con el período máximo que tenga saldo_pendiente_uf no nulo.
>    - Mostrarlo como "Último saldo registrado", nunca como "Saldo actual".
>    - Mostrar siempre el período correspondiente.
>    - No calcular ni proyectar saldos.
>
> 3. Seguridad de pruebas:
>    - Antes de cualquier escritura de integración, comprobar que TEST_DATABASE_URL apunta a una base diferente de DATABASE_URL y DIRECT_URL.
>    - Si no puede verificarse el aislamiento, detener las pruebas.
>    - No modificar credenciales, usuarios, configuraciones ni bases de datos para intentar resolver errores.

**T03 — refuerzo posterior del helper de aislamiento:**

> Compara las conexiones mediante sus componentes: host, puerto, nombre de base de datos y schema de PostgreSQL. No utilices las contraseñas para determinar si dos conexiones apuntan a la misma base. Si una URL es inválida o no se puede comprobar el aislamiento, omite las pruebas de integración. Mantén la posibilidad de utilizar el mismo usuario PostgreSQL para dos bases diferentes.

*Registro de implementación (condensado; no son prompts principales adicionales). Resume las
restricciones que la persona dio a la IA en el apply de cada ticket.*

| Etapa | Restricciones y decisiones de la persona |
|---|---|
| T04 | Usuario único; `pg_advisory_xact_lock`; no adelantar T05/T06; migración solo en `realtytrack_test` sin autorización adicional; sin tocar `.env`, sin commit ni push |
| T05 | 422 mediante `UnprocessableError`; un reajuste actualiza solo desde su período y no crea pagos; sincronización explícita e idempotente, sin escrituras desde un `GET`; interfaz obligatoria |
| T06 | Monto no positivo o fecha futura → 422; estado, saldo y completitud derivados, nunca persistidos; abonos conservados ante reajustes |
| T07 | Siete categorías sin `DIVIDENDO`; CLP enteros; agregación pura reutilizable; verificar que no se duplican dividendos; sin operaciones destructivas |
| T09 | Un único servicio; totales por fecha de caja; sin tablas, migraciones ni cachés; no declarar verificado si faltan pruebas o revisión manual |

> «Implementa completamente el change OpenSpec `t09-dashboard-financiero`» […] «si PostgreSQL no es accesible identifica las pruebas pendientes sin marcarlas como aprobadas» *(fragmentos representativos).*

**T08 — aportes de capital (changes `t08-aportes-capital` y `retirar-aportes-dashboard`).** La
persona aprobó el diseño, aplicó la migración y después **canceló** el ticket por decisión de
producto. La IA retiró solo su código y pruebas, conservó la migración histórica, generó la de
retiro (aplicada por la persona) y no archivó el change como implementado; un change mínimo
renombró «Flujo neto antes de aportes» a «Flujo neto» sin tocar fórmulas.

> «Vamos a retirar definitivamente T08: Aportes de capital del MVP RealtyTrack.» · «T09 debe conservar sus cálculos actuales.» · «No utilizar git clean ni restauraciones masivas.»

**T07 — ampliación con desglose de conceptos (change `t07-desglose-movimientos`).** Exploración,
diseño y apply en seis etapas con detención. La persona detectó que el diseño aprobado borraba el
desglose al omitir `conceptos` en el `PUT` y confirmó la **opción A**: ausente conserva, `[]`
convierte en simple, `null` da 400 y una lista reemplaza el desglose. La persona aplicó la
migración y ejecutó las pruebas; la revisión visual consta como parcial.

> «Un movimiento financiero puede ser simple o desglosado.» · «Los conceptos no son movimientos independientes.» · «El dashboard contabiliza una sola vez el total del movimiento.»
>
> «Apruebo el diagnóstico de ampliación de T07 y confirmo las decisiones técnicas:» (entre ellas: «Guardar el total calculado en MovimientoFinanciero.montoClp.», «Utilizar ON DELETE CASCADE para los conceptos.» y «Limitar a 50 conceptos y 100 caracteres por nombre.»)
>
> «Verifica que la semántica de PUT proteja los conceptos existentes cuando el campo conceptos se omite. Si el diseño todavía no contempla esta protección, detente y repórtalo antes de implementar.»
>
> «Confirmo la **opción A** para t07-desglose-movimientos.»
>
> «IMPORTANTE: Implementa únicamente la ETAPA 1 (modelo Prisma y migración). Detente al terminarla y espera mi aprobación.» · «No ejecutar prisma migrate dev ni migrate deploy.»
>
> «No marcar pruebas visuales como ejecutadas si no pudiste abrir la aplicación.» · «No marcar como ejecutadas pruebas que no hayan podido correr.»

*Decisiones técnicas registradas* (el detalle vive en `docs/data-model.md` §4.14, D15 y D16, y
en el change `t07-desglose-movimientos`):

| Decisión | Origen | Evidencia |
|---|---|---|
| Un movimiento padre con conceptos opcionales: entidad hija `movimiento_concepto`; sin conceptos = gasto simple, sin columna que lo marque | Propuesta de la IA en la exploración; aprobada por la persona | `docs/data-model.md` §4.14 |
| El total se calcula en el backend con `bigint` y se guarda en `movimiento_financiero.monto_clp` | Decisión de la persona | `docs/data-model.md` §4.10 y D15; `server/domain/movimiento-desglose.ts` |
| El `PUT` protege el desglose cuando se omite `conceptos`; solo `[]` lo elimina | La persona detectó el riesgo y confirmó la opción A; la IA propuso las alternativas | `docs/data-model.md` D16; spec `financial-movements` |
| Reemplazo atómico del desglose (borrado explícito y reinserción en una transacción) | Requisito de la persona; mecanismo propuesto por la IA | `design.md` del change; pruebas de servicio |
| T09 contabiliza solo el total del padre, sin leer ni sumar conceptos | Decisión de la persona (T09 sin cambios); pruebas escritas por la IA y ejecutadas por la persona | `tests/dashboard/dashboard-sin-conceptos.test.ts` y pruebas de T09 |
| Migraciones: la IA genera el SQL sin conexión; la persona lo revisa y lo aplica | Decisión de la persona | Prompts de T08 y de la etapa 1 del desglose |
| Verificación: pruebas ejecutadas localmente por la persona; revisión visual parcial | Declarado por la persona | `docs/work-tickets.md` §4.7 |


**T10 — integración de la UF (change `t10-integracion-uf`).** Exploración y apply por grupos con
detención. La IA recomendó mindicador.cl y la persona **eligió findic.cl** tras verificar sus
respuestas reales; después ajustó la referencia temporal de cada equivalente, retiró el 503 sin
consumidores, limitó la concurrencia y detectó que la ficha de propiedad no debía esperar a la UF.
Salvedad: el crédito sin `fechaOtorgamiento` tiene cobertura automatizada, sin comprobación visual.

> «Mantener un puerto ProveedorUf independiente del proveedor HTTP.» · «Usar el día 1 del mes como referencia para cada período.» · «No sobrescribir valores ya almacenados.» · «No estimar, interpolar ni reutilizar valores de otros períodos.» · «Usar Decimal para las conversiones monetarias.»
>
> «No implementar `UfNoDisponibleError` ni infraestructura sin consumidores actuales, salvo que identifiques un caso real que lo requiera.» · «Validar con Zod que sea positivo, finito y compatible con dos decimales.» · «Evitar operaciones monetarias con number.»
>
> «Limitar a un máximo de seis llamadas HTTP simultáneas a findic.cl dentro del servicio UF.» · «no agregues mecanismos complejos sin aprobación» (a propósito de la latencia con el proveedor caído; la persona aprobó después un corte anticipado con reglas explícitas) · «No afirmar que se ejecutaron sin omisiones si no existe evidencia del contador `skipped`.» · «Registrar explícitamente esta limitación; no presentarlo como una prueba visual ejecutada.»

*Decisiones técnicas registradas* (el detalle vive en `docs/work-tickets.md` §4.10,
`docs/architecture.md` §12 y `docs/data-model.md` §4.12, §8.4 y D17):

| Decisión | Origen | Evidencia |
|---|---|---|
| Proveedor findic.cl tras el puerto `ProveedorUf`; sin API key | Decisión de la persona: la IA había recomendado mindicador.cl; la persona eligió findic.cl tras verificar sus respuestas reales | `server/uf/findic.ts`; `docs/architecture.md` §12.1 |
| Día 1 como referencia del período, en un único punto del código | Decisión de la persona | `server/uf/uf-service.ts` (`fechaReferenciaPeriodo`); `docs/data-model.md` §8.4, D17 |
| Persistencia idempotente más relectura; sin sobrescribir | Requisito de la persona; mecanismo propuesto por la IA | `tests/uf/uf-service.integration.test.ts` |
| Período de cada equivalente: cuota → mes actual; saldo inicial → `fechaOtorgamiento`; registro mensual → su período; dashboard → mes consultado | Decisión de la persona | `docs/architecture.md` §12.5; pruebas de integración de los grupos 5 a 7 |
| Dashboard con métodos específicos para equivalentes; la ficha de propiedad no consulta la UF | La persona identificó el riesgo; la IA lo resolvió | `tests/dashboard/dashboard-uf-consumidores.test.ts` |
| Máximo de 6 llamadas y corte anticipado tras 6 fallos consecutivos | Reglas de la persona; implementación y pruebas de la IA | `tests/uf/uf-service.concurrencia.test.ts`; `docs/architecture.md` §12.3 |
| Sin error 503 en T10 (AC4 documentado, no implementado) | Decisión de la persona | `docs/architecture.md` §12.4, §17 |
| Verificación: pruebas, build, proveedor real y revisión visual ejecutadas por la persona; una salvedad visual | Declarado por la persona | `docs/work-tickets.md` §4.10 |

**Cierre funcional (dashboard histórico, edición de arrendatarios, corrección de montos y documentos
T11).** Cuatro changes de OpenSpec propuestos, implementados, verificados y archivados con revisión
humana de las decisiones de negocio. Decisiones de la persona: bloquear con 422 todo cambio de monto
que afecte pagos con abonos (incluido el alta de reajustes), sin ajustes compensatorios;
Cloudflare R2, PDF/JPEG/PNG/WebP y 20 MB para documentos; sin dependencias nuevas. Aporte de la IA:
firma SigV4 con `node:crypto` verificada con el vector oficial de AWS y una revisión de seguridad que
añadió un token de subida emitido por el servidor y la validación del objeto real. La IA no pudo
ejecutar pruebas de integración, build ni R2 en su entorno; la persona los ejecutó localmente y
validó manualmente la interfaz y R2.

**Rediseño integral del frontend (change `rediseno-frontend`).** Un único change de OpenSpec
(propose + apply + verify autónomos por autorización de la persona; archivado tras la validación
visual y funcional local de la persona). La IA construyó primero el sistema de diseño y el layout compartido y lanzó
3 subagentes por módulos con archivos exclusivos. Realmente: el subagente de propiedades y créditos
terminó; los de contratos/pagos y de movimientos/documentos quedaron bloqueados por permisos de
escritura del entorno y se detuvieron, por lo que la IA completó esos módulos de forma secuencial. La
skill `frontend-design` no existe en el entorno y no se usó. Dependencias nuevas autorizadas:
`lucide-react` y `recharts`. La IA no pudo ejecutar el build ni la revisión visual en su sandbox.

**Porcentaje de pie hipotecario (change `porcentaje-pie-hipotecario`).** Change independiente de
OpenSpec (propose + apply + verify autónomos por autorización de la persona; sin commit, push,
archive ni migraciones ejecutadas por la IA; archivado tras la validación local de la persona). Campo opcional `porcentaje_pie` `DECIMAL(5,2)` con `CHECK` 0–100,
migración no destructiva, validación sin `Number`, monto estimado del pie como función pura y barra
pie/resto en el detalle del crédito, reutilizando el sistema de diseño de `rediseno-frontend` sin
modificarlo. Decisión de producto de la persona: el pie es dato informado, no se deduce del monto
original ni se contabiliza como egreso. La IA no pudo ejecutar migraciones ni pruebas de integración
con PostgreSQL en su entorno; la persona las ejecutó localmente.

---

### 7. Pull Requests

El [PR #1](https://github.com/elianasaraith/feature-entrega-1-ESRF/pull/1)
(`final-project-esrf` → `main`) está integrado (`54f570c`). El repositorio no registra prompts
usados para crearlo, así que no se documenta ninguno.
