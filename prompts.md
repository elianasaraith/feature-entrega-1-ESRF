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

*Sin prompt distintivo propio para esta fase: quedó cubierta por el prompt inicial de 2.2, sin una corrección puntual separada.*

### **2.5. Seguridad**

**Prompt 1:**

*Mismo mensaje de corrección citado en 2.2 y 2.3 (punto 3 de 3).*

> 3. En §11 evita comprometer el documento con detalles internos de "rotación" de Auth.js. Di simplemente que Auth.js gestiona la creación, protección y lectura de la sesión y su cookie, manteniendo como decisiones explícitas Credentials + JWT + cookie httpOnly/Secure/SameSite + Argon2id.

### **2.6. Tests**

*La estrategia de testing se definió dentro del prompt inicial de 2.2. El siguiente prompt corresponde a la implementación de las pruebas de integración de T01.*

**Prompt 1:**

*Fragmento del mensaje de implementación de T01 (seguridad de datos en las pruebas).*

> 6. Seguridad de datos: no modificar ni eliminar las 3 propiedades existentes. No ejecutar TRUNCATE. No ejecutar el seed completo. No ejecutar pruebas de integración contra la base de desarrollo por defecto. Las pruebas de integración deben requerir TEST_DATABASE_URL explícita y utilizar una BD de pruebas independiente. Las pruebas solo pueden eliminar sus propios datos.

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

*Este primer prompt refleja la interpretación inicial de que el límite de tres tickets aplicaba también al backlog detallado de docs/work-tickets.md. Esa interpretación fue corregida en el Prompt 2, que distingue el backlog técnico completo de los tres trabajos representativos que exige el README.*

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

> Quiero corregir una interpretación del alcance.
>
> El límite de 3 tickets corresponde a los tickets representativos que posteriormente mostraremos en readme.md, no necesariamente al contenido completo de docs/work-tickets.md.
>
> docs/work-tickets.md debe representar el backlog técnico necesario para implementar el MVP de forma razonable. Puede contener más de 3 tickets si dividir el trabajo mejora su implementabilidad y trazabilidad.
>
> Aplica la misma separación conceptual que existe con las historias de usuario: la documentación detallada puede contener más elementos y el README posteriormente seleccionará únicamente los elementos representativos exigidos por la plantilla.
>
> Por lo tanto, replantea el plan:
>
> * No limites docs/work-tickets.md a 3 tickets.
> * Deriva los tickets desde product.md, user-stories.md, data-model.md y architecture.md.
> * Evita tickets demasiado grandes que equivalgan prácticamente a una HU completa.
> * Cada ticket debe representar una unidad de trabajo implementable y verificable.
> * Mantén trazabilidad hacia una o más HU.
> * Puedes incluir tickets transversales cuando correspondan a capacidades reales del MVP, como autenticación, UF o documentos, pero evita fragmentar innecesariamente la infraestructura.
> * No inventes funcionalidades.
>
> Para cada ticket propuesto indica: 1. título; 2. tipo principal (backend, frontend, database, full-stack o transversal); 3. objetivo; 4. HU relacionada; 5. alcance resumido; 6. dependencias.
>
> Además, identifica cuáles 3 tickets serían buenos candidatos para mostrar posteriormente en readme.md, cumpliendo la exigencia de seleccionar uno de backend, uno de frontend y uno de base de datos. Esa selección es solo representativa y no elimina los demás tickets.
>
> No escribas todavía docs/work-tickets.md. Muéstrame primero el nuevo plan.

**Prompt 3:**

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

*Implementación posterior del ticket T01 (Gestión de propiedades) con OpenSpec: fragmento del mensaje que aprobó el plan y fijó las precisiones de autenticación, pruebas de integración y validaciones.*

> 1. Autenticación: las rutas /api/* sin sesión deben responder 401 JSON. Las páginas protegidas deben seguir redirigiendo a /login. No alterar /api/auth/*. Mantener requireSession() en los Route Handlers.
> 2. Pruebas de integración: no modificar ni eliminar las 3 propiedades existentes. No ejecutar TRUNCATE ni el seed completo. Las pruebas deben crear y limpiar exclusivamente sus propios registros. Preferir una BD de pruebas aislada si resulta sencillo.
> 3. Validaciones: utilizar Zod con reglas específicas para Propiedad. Validar fechas calendario reales, no solo YYYY-MM-DD. Respetar los tipos y restricciones de Prisma/PostgreSQL. Evitar abstracciones genéricas innecesarias.

---

### 7. Pull Requests

*Pendiente para las siguientes entregas. Entrega 1 es exclusivamente documental: no existen Pull Requests propias de este trabajo todavía, así que no hay prompts que documentar en esta sección.*
