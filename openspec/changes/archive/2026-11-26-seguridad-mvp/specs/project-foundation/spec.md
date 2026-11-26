## ADDED Requirements

### Requirement: Build que genera el cliente de Prisma
El script `build` del proyecto SHALL ejecutar `prisma generate` antes de `next build`, de modo que el despliegue no dependa de efectos secundarios de la instalación.

#### Scenario: Script de build
- **WHEN** se lee el script `build` de `package.json`
- **THEN** es `prisma generate && next build`

### Requirement: Variables de entorno de seguridad documentadas
El archivo `.env.example` SHALL documentar, sin valores sensibles, las variables de entorno de seguridad que exige la aplicación (`AUTH_SECRET`, `APP_ORIGINS`, `DOCUMENT_UPLOAD_SECRET` y las del almacenamiento S3), indicando cuáles son obligatorias en producción. La aplicación SHALL NOT reutilizar las credenciales del almacenamiento ni `AUTH_SECRET` como secreto de otro propósito.

#### Scenario: Variables documentadas
- **WHEN** se lee `.env.example`
- **THEN** contiene `APP_ORIGINS` y `DOCUMENT_UPLOAD_SECRET` con valores vacíos o de ejemplo no sensibles

#### Scenario: Sin secreto de subida
- **WHEN** falta `DOCUMENT_UPLOAD_SECRET`
- **THEN** las operaciones de subida de documentos responden 503 y no se usa ningún otro secreto como sustituto

### Requirement: Riesgo residual de dependencias documentado con evidencia
La documentación SHALL registrar las vulnerabilidades de dependencias aceptadas (deepmerge-ts, effect, `@prisma/config`, `prisma` y minimatch/ESLint) con la salida completa de `npm audit` y `npm audit --omit=dev`, la evidencia de alcanzabilidad (no cargadas por el runtime de `@prisma/client`, sin `prisma.config.ts`, `Schema.TemplateLiteral` no usado) y el criterio de reevaluación. La documentación SHALL NOT presentar el resultado filtrado del audit como ausencia total de vulnerabilidades.

#### Scenario: Riesgo residual registrado
- **WHEN** se consulta la sección de seguridad de la documentación
- **THEN** figuran cada vulnerabilidad aceptada, su alcanzabilidad por entorno (runtime, build, desarrollo) y la salida completa del audit
