## Context

El repositorio hoy no contiene ningún artefacto de código (`package.json`, `prisma/`, `docker-compose.yml` y `.env.example` no existen). Entrega 1 fue solo documentación. `docs/architecture.md` ya documenta el stack confirmado (Next.js App Router + TypeScript, Tailwind, Prisma sobre PostgreSQL/Neon, Vercel) y varias convenciones de datos (`docs/data-model.md` §2: UUID, snake_case singular, `NUMERIC` para dinero, `TIMESTAMPTZ` para metadata), pero no describe cómo se corre el proyecto en local — toda la infraestructura documentada (§15) es Vercel + Neon, sin mención de Docker Compose.

Este change construye la primera base ejecutable, sin implementar ningún ticket funcional del backlog (`docs/work-tickets.md`, T01–T12).

## Goals / Non-Goals

**Goals:**
- Scaffold de Next.js + TypeScript + Tailwind generado sin pisar la documentación existente del repo.
- Entorno de PostgreSQL local reproducible para desarrollo.
- Prisma conectado a ese PostgreSQL, con una migración mínima que contiene únicamente el modelo `Propiedad` y el enum `moneda` que necesita, siguiendo exactamente `docs/data-model.md` §4.2.
- Seed con datos completamente ficticios y representativos, sin ningún dato derivado de la cartera real del usuario.
- Verificación técnica de la conexión Prisma↔PostgreSQL mediante un script o test ejecutado desde Node/TypeScript, nunca mediante una ruta HTTP de la aplicación.
- `.env.example` versionado, incremental, con solo las variables que esta etapa necesita.

**Non-Goals:**
- Autenticación (T12), integración con la API de UF (T10), object storage (T11).
- Cualquier entidad del data model distinta de `Propiedad` (crédito hipotecario, contrato de arriendo, pago de arriendo, movimiento financiero, aporte de capital, documento).
- Cualquier Route Handler o pantalla de negocio (eso es T01 y siguientes).
- Despliegue real o pipeline de CI/CD — sigue sin existir en esta etapa.

## Decisions

- **Gestor de paquetes: `npm`.** No hay ningún documento del proyecto que fije uno; `npm` viene con Node y no agrega una herramienta nueva que justificar. Alternativas consideradas: `pnpm` (mejor manejo de workspaces, innecesario para un único paquete), `yarn` (sin ventaja clara aquí).

- **Scaffold de Next.js aislado vía directorio temporal + copia selectiva.** `create-next-app` falla o exige `--force` en un directorio no vacío, y el repo ya tiene `docs/`, `openspec/`, `.claude/`, `readme.md`, `prompts.md`. Se genera el scaffold en un directorio temporal fuera del repo y se copian al root solo los artefactos de la aplicación: `app/`, `public/`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, configuración de Tailwind/PostCSS, y además `eslint.config.mjs` y `next-env.d.ts` (necesarios para que `npm run lint` y el tipado de Next.js funcionen; no estaban en la enumeración original porque `create-next-app` no los generaba como archivos "de configuración" separados hasta esta versión). Ningún archivo de documentación existente se sobrescribe; si `create-next-app` genera su propio `.gitignore` o `README.md`, se fusionan a mano. Alternativa descartada: `--force` directo en el root, que arriesga sobrescribir `readme.md` o `.gitignore` sin control.

- **`README.md` y `AGENTS.md` del scaffold se excluyen deliberadamente, no se copian ni se fusionan.** La versión de `create-next-app` usada genera ambos por defecto. `README.md` no se copia porque el filesystem del proyecto es case-insensitive: `README.md` resuelve al mismo archivo que `readme.md` (el entregable oficial de la plantilla AI4Devs, de 43KB) y copiarlo lo habría sobrescrito. `AGENTS.md` no se copia porque no estaba en el alcance aprobado de este change y el repo ya tiene su propio `CLAUDE.md` cumpliendo un rol equivalente. Alternativa descartada: fusionar su contenido a mano en `readme.md`/`CLAUDE.md` — agregaría contenido genérico de scaffold a documentos que deben seguir siendo autocontenidos y específicos del proyecto.

- **PostgreSQL 16 vía Docker Compose, puerto host `5436` mapeado al `5432` del contenedor.** Postgres 16 es compatible con la versión mayor que soporta Neon. El puerto no estándar evita chocar con una instalación local de Postgres que el usuario pueda tener corriendo en el `5432` por defecto. (Se probaron `5433`, `5434` y `5435` antes; el usuario confirmó con `lsof` que los tres estaban ocupados por procesos PostgreSQL locales de trabajos anteriores, y que `5436` está libre.)

- **`DATABASE_URL` y `DIRECT_URL` como dos variables, ambas apuntando al mismo PostgreSQL local.** `docs/architecture.md` §9.2 exige dos cadenas de conexión distintas en producción (pooled vs. direct, por el pgBouncer de Neon). En desarrollo local no existe un pooler, pero mantener las dos variables preserva la simetría con producción sin esfuerzo adicional — Prisma ya soporta `url`/`directUrl` en el datasource. Alternativa descartada: una sola variable local, que bifurcaría la configuración entre entornos sin necesidad.

- **Los valores reales de desarrollo se definen en `.env`, no en `.env.local`.** Next.js carga ambos automáticamente, pero el CLI de Prisma (`validate`, `migrate`, `db seed`, etc.) solo carga `.env` por convención propia — no conoce `.env.local`, que es una convención exclusiva de Next.js. Usar `.env` evita que los comandos de Prisma fallen con `P1012: Environment variable not found` y evita además duplicar credenciales en dos archivos. `.env` permanece no versionado bajo el mismo patrón `.gitignore` que ya cubría `.env.local`; `.env.example` (versionado, solo nombres) no cambia. Alternativa descartada: mantener `.env.local` y agregar un `prisma.config.ts` o flags por comando para apuntar a él — resuelve lo mismo con más piezas que mantener.

- **El esquema que introduce esta fundación declara `Propiedad` + enum `moneda`, sin anticipar entidades de capacidades aún no implementadas.** `docs/architecture.md` (línea 330) describe el esquema final como un espejo de las 13 entidades del data model, pero no existe ningún patrón incremental documentado. Este change introduce solo el subconjunto necesario para su propio alcance — no establece una restricción permanente sobre el esquema del proyecto. El resto de las entidades se incorpora en los changes de los tickets que las necesiten (T02, T04, T07, T08, T11...), cada uno ampliando el esquema en su momento.

- **Seed con datos 100% ficticios, no anonimizados.** CLAUDE.md exige anonimizar cualquier dato real antes de versionarlo, pero para la fundación se va un paso más allá: las 3 propiedades del seed son inventadas desde cero (sin número de departamento, dirección, superficie ni montos de la cartera real), para no arrastrar ninguna huella de los datos reales al repositorio.

- **Verificación de conexión como script TypeScript puntual, no como framework de test ni endpoint HTTP.** No hay todavía lógica de negocio que testear, así que introducir un framework de test completo sería anticipar una necesidad que no existe aún; un endpoint `/health` expondría superficie HTTP solo para auto-chequeo, lo cual el usuario descartó explícitamente. Se usa un script ejecutado con `tsx` que instancia `PrismaClient` y corre una consulta trivial, invocado vía `npm run db:verify`. Se reevaluará cuando un ticket funcional (p. ej. T01) introduzca el primer test de servicio real.

- **`tsconfig.json` con `strict: true` desde el scaffold inicial.** CLAUDE.md ya promete tipado estricto (sin `any`) para las "siguientes entregas"; como este change ya pertenece a la siguiente entrega, se activa desde el inicio en lugar de habilitarlo después.

- **Restricciones de `docs/data-model.md` §4.2 (`superficie_m2 > 0`, `valor_compra_monto > 0`, sin parte decimal si la moneda es CLP) como SQL explícito en una migración incremental, no en `schema.prisma`.** El requirement de `specs/project-foundation/spec.md` exige explícitamente "los campos y restricciones" de `docs/data-model.md` §4.2, y la migración inicial (`20261011025948_init_propiedad`) las había dejado fuera. Prisma 6.19.3 no tiene un atributo de esquema para declarar `CHECK` constraints arbitrarios (se verificó: no hay ninguna coincidencia de `@@check` en los paquetes `@prisma/*` instalados), así que no hay forma de representarlas directamente en `schema.prisma`. Se agregan con `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` en una migración nueva (`prisma/migrations/20261013120000_add_propiedad_check_constraints/migration.sql`), sin modificar la migración ya aplicada — las migraciones de Prisma son inmutables una vez aplicadas. `schema.prisma` lleva un comentario señalando dónde viven estas restricciones, para que no se interpreten como ausentes al leer solo el esquema. Alternativa descartada: posponerlas a T01 — se rechaza porque el requirement de esta fundación las exige explícitamente, no son alcance funcional de "Gestión de propiedades".

## Risks / Trade-offs

- **Docker Compose no está documentado en `docs/architecture.md`** → Mitigación: es una pieza puramente de desarrollo local, no afecta el destino de producción (Vercel + Neon, sin cambios). Se documenta aquí como parte del change, no como una revisión de arquitectura de producción.

- **`docs/work-tickets.md` §2 establece que ningún ticket es una "capa técnica aislada" y que la infraestructura vive dentro del ticket funcional que la necesita** → Este change introduce una categoría de trabajo (fundación previa a cualquier ticket) que el backlog no contempla hoy. Mitigación: se trata como una decisión de alcance puramente a nivel de planificación OpenSpec, documentada en `proposal.md`, sin modificar `docs/work-tickets.md`. Riesgo aceptado: quien lea solo `docs/work-tickets.md` no verá de dónde surgió esta fundación.

- **El esquema mínimo (`Propiedad` únicamente) se aparta de la descripción de `docs/architecture.md` de un esquema único que refleja las 13 entidades** → Mitigación: crecimiento incremental documentado explícitamente aquí como decisión deliberada; cada ticket que necesite una entidad nueva la agrega en su propio change.

- **El script de verificación podría quedar obsoleto o sin mantenimiento una vez que existan tests reales de servicio** → Mitigación: se documenta como un mecanismo transitorio, explícitamente destinado a desaparecer o integrarse cuando T01 introduzca su propia estrategia de pruebas.

- **Los `CHECK` de `propiedad` viven en SQL de migración, no en `schema.prisma`, así que Prisma no los conoce al generar diffs futuros** → Un `prisma migrate dev` o `prisma db pull` posterior no los detectará como parte del esquema declarado; alguien podría asumir por error que ya no existen, o un `prisma db push` sin pasar por migraciones podría dejarlos fuera de un entorno nuevo. Mitigación: el comentario en `schema.prisma` junto al modelo `Propiedad` señala explícitamente dónde viven; cualquier ticket que modifique esta tabla debe revisar esa migración antes de asumir el esquema completo.
