## Why

RealtyTrack cierra Entrega 1 como documentación pura: no existe ningún artefacto de código en el repositorio. Para avanzar a Entrega 2 se necesita una base ejecutable real (aplicación, base de datos, ORM) antes de poder implementar cualquier ticket funcional del backlog (T01–T12). Sin esta fundación, T01 ("Gestión de propiedades", el ticket fundacional del backlog funcional) no tiene dónde correr.

## What Changes

- Scaffold de una aplicación Next.js + TypeScript + Tailwind, generado de forma aislada para no sobrescribir la documentación existente del repositorio (`docs/`, `openspec/`, `readme.md`, `prompts.md`, `.claude/`).
- Entorno de base de datos PostgreSQL local para desarrollo.
- Prisma como ORM, con una primera migración mínima que contiene únicamente el modelo `Propiedad` (y el enum `moneda` que ese modelo necesita) — ninguna otra entidad del data model todavía.
- Un seed de datos completamente ficticios y representativos, sin ningún dato proveniente de la cartera real del usuario (ni siquiera ofuscado).
- Un mecanismo de verificación técnica de la conexión Prisma↔PostgreSQL, que no es un endpoint HTTP de la aplicación.
- Un archivo `.env.example` incremental, con solo las variables necesarias para esta etapa (conexión a la base de datos).

## Capabilities

### New Capabilities
- `project-foundation`: entorno de desarrollo ejecutable local (base de datos, ORM, esquema mínimo, seed y verificación de conectividad) sobre el que se construyen los tickets funcionales.

### Modified Capabilities
(ninguna — no existen specs previas en `openspec/specs/`; este es el primer change del proyecto)

## Impact

- Introduce el primer código de aplicación del repositorio: estructura Next.js, `prisma/schema.prisma`, `prisma/seed.ts`, un mecanismo de verificación de conexión, configuración de base de datos local, y `.env.example`.
- No implementa lógica de negocio ni endpoints de producto: no corresponde a ningún ticket funcional T01–T12, ni es una capacidad transversal como T10 (UF), T11 (almacenamiento) o T12 (autenticación). Esas capacidades quedan explícitamente fuera y se agregan en sus propios changes cuando correspondan.
- Este change no está asociado a ningún ticket del backlog (`docs/work-tickets.md`); es una decisión de alcance a nivel de planificación OpenSpec. `docs/work-tickets.md` §2 no contempla hoy esta categoría de trabajo (infraestructura previa a cualquier ticket funcional, no transversal); se documenta aquí para que esa decisión quede trazada, sin modificar `docs/work-tickets.md`.
