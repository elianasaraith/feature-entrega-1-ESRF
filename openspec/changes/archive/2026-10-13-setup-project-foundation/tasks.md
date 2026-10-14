## 1. Scaffold de Next.js aislado

- [x] 1.1 Generar el scaffold de Next.js + TypeScript + Tailwind en un directorio temporal fuera del repositorio
- [x] 1.2 Copiar al root del repositorio solo los artefactos de la aplicación (`app/`, `public/`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, configuración de Tailwind/PostCSS), sin sobrescribir `docs/`, `openspec/`, `readme.md`, `prompts.md`, `.claude/`
- [x] 1.3 Fusionar a mano cualquier `.gitignore`/`README.md` generado por el scaffold con los existentes del repo
- [x] 1.4 Activar `strict: true` en `tsconfig.json`

## 2. Entorno de base de datos local

- [x] 2.1 Crear `docker-compose.yml` con un servicio de PostgreSQL 16, puerto host `5436` mapeado al `5432` del contenedor, y un volumen nombrado para persistencia
- [x] 2.2 Levantar el contenedor (`docker compose up -d`) y confirmar que PostgreSQL acepta conexiones

## 3. Variables de entorno

- [x] 3.1 Crear `.env.example` versionado con únicamente `DATABASE_URL` y `DIRECT_URL`
- [x] 3.2 Crear `.env` (no versionado) con los valores reales apuntando al PostgreSQL de Docker Compose (puerto host `5436`) — no `.env.local`, porque Prisma CLI solo carga `.env` automáticamente

## 4. Prisma y esquema mínimo

- [x] 4.1 Inicializar Prisma en el proyecto
- [x] 4.2 Configurar el datasource con `url = env("DATABASE_URL")` y `directUrl = env("DIRECT_URL")`
- [x] 4.3 Declarar el enum `moneda` (`UF`, `CLP`) en `schema.prisma`
- [x] 4.4 Declarar el modelo `Propiedad` replicando exactamente los campos de `docs/data-model.md` §4.2 (número de departamento, superficie, valor de compra + moneda, fecha de compra, estacionamiento y bodega opcionales, timestamps)
- [x] 4.5 Generar y aplicar la primera migración (`prisma migrate dev --name init_propiedad`) contra el PostgreSQL local, usando `DATABASE_URL`/`DIRECT_URL` ya definidas en `.env`
- [x] 4.6 Preparar una migración incremental con los `CHECK` de `docs/data-model.md` §4.2 (`superficie_m2 > 0`, `valor_compra_monto > 0`, sin parte decimal si la moneda es CLP) como SQL explícito, sin modificar la migración `init_propiedad` ya aplicada
- [x] 4.7 Aplicar localmente la migración `add_propiedad_check_constraints` y confirmar que las tres restricciones quedan activas en PostgreSQL

## 5. Seed con datos ficticios

- [x] 5.1 Escribir `prisma/seed.ts` con 3 propiedades completamente ficticias y representativas, sin ningún dato derivado de la cartera real del usuario
- [x] 5.2 Exponer el seed como script manual (`npm run db:seed`), sin encadenarlo al build ni a ningún hook automático

## 6. Verificación de conexión

- [x] 6.1 Escribir un script TypeScript (ejecutado con `tsx`) que instancie `PrismaClient` y ejecute una consulta trivial contra `Propiedad`
- [x] 6.2 Exponer el script como `npm run db:verify`, sin crear ningún endpoint HTTP para este propósito
- [x] 6.3 Ejecutar el script contra el PostgreSQL local y confirmar que reporta éxito

## 7. Verificación end-to-end del change

- [x] 7.1 Confirmar que `docker compose up -d`, la migración, el seed y `npm run db:verify` se ejecutan en secuencia sin errores
- [x] 7.2 Confirmar que `npm run dev` levanta la aplicación Next.js sin errores, aunque todavía no exponga ninguna pantalla de negocio
- [x] 7.3 Confirmar que ningún archivo bajo `docs/`, `openspec/`, `readme.md`, `prompts.md` o `.claude/` fue modificado por el scaffold
