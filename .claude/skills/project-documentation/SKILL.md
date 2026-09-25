---
name: project-documentation
description: Procedimiento para crear, revisar y mantener consistente la documentación técnica de RealtyTrack — docs/product.md, docs/user-stories.md, docs/data-model.md, docs/architecture.md, docs/work-tickets.md, docs/diagrams/, las secciones de la plantilla AI4Devs en readme.md y el registro de IA en prompts.md. Úsala al redactar o modificar cualquiera de esos documentos, al propagar un cambio de requisito, modelo o arquitectura entre ellos, y al revisar la coherencia entre docs/ y el README. No aplica al código de aplicación.
---

# Documentación técnica de RealtyTrack

El contexto funcional y las reglas del proyecto están definidos en `CLAUDE.md`. No los
dupliques dentro de esta skill. Al crear documentación del entregable, usa `CLAUDE.md`
como fuente de verdad y traslada al documento objetivo únicamente la información
relevante para que ese documento sea autocontenido.

Separación de roles:

- `CLAUDE.md` — fuente de contexto para Claude
- esta skill — procedimiento de documentación
- `docs/` — documentación técnica dirigida a personas
- `readme.md` — entregable principal autocontenido

## 1. Cargar el contexto mínimo

Leer, en este orden, y nada más:

1. `CLAUDE.md`
2. el documento que se va a modificar
3. solo los documentos que el cambio pueda afectar (§3)

No abrir `docs/` completo por defecto.

## 2. Clasificar antes de escribir

Toda afirmación pertenece a una categoría, y el lector debe poder distinguir cuál:

| Categoría | Cómo se escribe |
|---|---|
| Requisito confirmado | Afirmación directa |
| Regla de negocio confirmada | Afirmación directa |
| Decisión técnica confirmada | Afirmación directa + justificación |
| Propuesta pendiente de validación | Marcada explícitamente como *propuesta a validar* |
| Fuera de alcance | Declarada como fuera de alcance, nunca descrita como existente |

Una propuesta no se convierte en decisión confirmada por reescribirla. Si falta una
decisión funcional que bloquea, señalarla y parar.

## 3. Identificar el impacto antes de modificar

Determinar la cadena de propagación y tocar **solo** esos documentos:

| Cambio | Propagación |
|---|---|
| Requisito | `product.md` → `user-stories.md` → `data-model.md` → `architecture.md` |
| Historia de usuario | `user-stories.md` → `data-model.md` → `work-tickets.md` |
| Modelo de datos | `data-model.md` → `architecture.md` → `work-tickets.md` |
| Arquitectura | `architecture.md` (incluye infraestructura y seguridad) → `readme.md` |

Si el cambio afecta a los endpoints representativos, actualizar además la **sección API
de `readme.md`**. No existe `docs/api/` ni una especificación OpenAPI independiente: no
los crees.

Si el cambio alcanza cualquier otra sección oficial del README, se refleja allí en su
versión integrada. Un documento sin relación con el cambio no se modifica.

## 4. Detalle e integración

`docs/` lleva el detalle. `readme.md` es el entregable autocontenido que resume e integra
las decisiones relevantes. No copiar bloques textuales entre ambos: en el README va la
versión sintetizada, no un recorte.

## 5. Orden de creación inicial

producto → historias de usuario → modelo de datos → arquitectura → tickets → integración
en el README → revisión del registro de IA.

En iteraciones posteriores el orden lo marca la cadena de impacto de §3.

## 6. Calidad documental

Favorecer: lenguaje técnico claro · decisiones justificadas · criterios verificables ·
ejemplos cuando aporten comprensión · trazabilidad entre requisito y solución.

Evitar: lenguaje promocional · explicaciones redundantes · arquitectura especulativa ·
requisitos inventados · describir funcionalidad fuera del MVP como si estuviera
implementada.

## 7. Registro del uso de IA

No registrar cada interacción en `prompts.md`. Registrar solo los prompts o workflows que
demuestren el uso de IA en la fase correspondiente, dentro de los límites de la plantilla
definidos en `CLAUDE.md`.

## 8. Antes de cerrar la tarea

- ¿El README sigue comprendiéndose por sí solo?
- ¿`docs/` y el README dicen lo mismo, sin duplicar texto?
- ¿Las propuestas siguen marcadas como propuestas?
- ¿Se modificó algún documento ajeno al cambio?
- ¿Se generó documentación que nadie pidió?
