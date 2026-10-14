## ADDED Requirements

### Requirement: Entorno de desarrollo local con PostgreSQL
El proyecto SHALL proveer un entorno de desarrollo local reproducible que levante una instancia de PostgreSQL mediante Docker Compose, sin depender de una instalación de PostgreSQL ya existente en la máquina del desarrollador.

#### Scenario: Levantar la base de datos local
- **WHEN** un desarrollador ejecuta el comando de Docker Compose definido por el proyecto
- **THEN** una instancia de PostgreSQL queda disponible en el puerto local configurado, lista para que Prisma se conecte

### Requirement: Conexión de Prisma a PostgreSQL mediante variables de entorno
La aplicación SHALL conectarse a PostgreSQL exclusivamente a través de las variables de entorno `DATABASE_URL` y `DIRECT_URL`, sin cadenas de conexión hardcodeadas en el código.

#### Scenario: Conexión usando variables de entorno
- **WHEN** Prisma se inicializa con `DATABASE_URL` y `DIRECT_URL` configuradas hacia el PostgreSQL local
- **THEN** Prisma establece la conexión sin requerir ningún valor de conexión escrito directamente en el código fuente

### Requirement: Esquema introducido por esta fundación
El esquema de Prisma que este change introduce SHALL declarar el modelo `Propiedad` y el enum `moneda`, con los campos y restricciones definidos en `docs/data-model.md` §4.2 (número de departamento, superficie, valor de compra con su moneda, fecha de compra, estacionamiento y bodega opcionales), sin anticipar entidades de capacidades todavía no implementadas.

#### Scenario: Migración introducida por este change
- **WHEN** se aplica la migración que este change introduce contra el PostgreSQL local
- **THEN** la base de datos queda con la tabla `Propiedad` y el enum `moneda` definidos según `docs/data-model.md` §4.2

### Requirement: Seed con datos ficticios
El proyecto SHALL incluir un script de seed que registre exclusivamente propiedades ficticias de desarrollo, creadas expresamente para este propósito, sin usar la cartera real del usuario como fuente.

#### Scenario: Ejecutar el seed
- **WHEN** un desarrollador ejecuta el script de seed manualmente
- **THEN** se insertan propiedades cuyos valores están definidos como literales ficticios directamente en el script, sin leer ni derivar ningún valor de la cartera real del usuario

### Requirement: Verificación de la conexión sin superficie HTTP
El proyecto SHALL ofrecer un mecanismo de verificación técnica de la conexión Prisma↔PostgreSQL ejecutado desde un script o test de Node/TypeScript, y no SHALL exponer un endpoint HTTP de la aplicación únicamente para ese propósito.

#### Scenario: Verificar la conexión
- **WHEN** un desarrollador ejecuta el mecanismo de verificación de conexión
- **THEN** el mecanismo reporta éxito o falla de la conexión Prisma↔PostgreSQL sin que la aplicación Next.js tenga que levantarse ni exponer ninguna ruta adicional

### Requirement: Aislamiento del scaffold respecto a la documentación del repositorio
El proceso de generación del scaffold de Next.js SHALL dejar intactos los archivos y carpetas de documentación existentes del repositorio (`docs/`, `openspec/`, `readme.md`, `prompts.md`, `.claude/`).

#### Scenario: Generar el scaffold sin afectar la documentación
- **WHEN** se genera el scaffold de Next.js siguiendo el proceso de aislamiento definido en `design.md`
- **THEN** ningún archivo bajo `docs/`, `openspec/`, `readme.md`, `prompts.md` o `.claude/` resulta modificado o sobrescrito
