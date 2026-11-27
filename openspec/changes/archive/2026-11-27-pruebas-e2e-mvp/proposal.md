## Why

La entrega final del máster exige al menos una prueba E2E que cubra un flujo principal completo del producto. Hoy solo existen pruebas unitarias y de integración con `node:test`; ninguna recorre navegador, API y PostgreSQL reales.

## What Changes

- Añadir Playwright (solo `@playwright/test`, navegador Chromium) como dependencia de desarrollo.
- Cinco escenarios E2E en total (credenciales inválidas, flujo principal y tres escenarios por área: hipoteca, finanzas y arriendos). El flujo principal: login con credenciales válidas → crear propiedad → crear contrato con arrendatario nuevo → sincronizar pagos esperados y registrar el pago → comprobar el ingreso en el dashboard → cerrar sesión y comprobar que el acceso protegido redirige al login. Una prueba cubre credenciales inválidas. Los otros tres escenarios cubren: crédito con pie, edición y dividendo mensual; gasto, listado, dashboard exacto y navegación de períodos; y arrendatario, reajuste y pagos esperados por vigencia.
- Frontend, backend y PostgreSQL reales, sin mocks; la aplicación se levanta con `next dev` en un puerto propio apuntando solo a la base de pruebas.
- Aislamiento: el setup global exige `TEST_DATABASE_URL`, reutiliza la guarda de aislamiento existente (`tests/setup/test-db.ts`), exige que el nombre de la base contenga `test` o `e2e`, vacía las tablas de dominio y siembra un usuario ficticio. Esto lo hace repetible y reinicia el contador de intentos de login.
- Scripts `test:e2e`, `test:e2e:db` (`scripts/e2e-migrate.ts`: carga `.env`, valida la guarda y migra solo `TEST_DATABASE_URL`) y `test:e2e:install`; documentación en `readme.md` y registro en `prompts.md`.

Fuera de alcance: más escenarios E2E, CI, múltiples navegadores, cambios en la aplicación, la UF, créditos, documentos/R2.

## Capabilities

### New Capabilities
- `e2e-testing`: prueba E2E con Playwright del flujo principal sobre base de pruebas aislada.

### Modified Capabilities
(ninguna)

## Impact

- Código: nuevos `playwright.config.ts` y `e2e/*`; `package.json` (scripts y `@playwright/test`); `.gitignore` (artefactos de Playwright). Sin cambios en `app/` ni `server/`.
- Base de datos: la de pruebas se vacía en cada ejecución; ninguna otra se toca.
- Dependencias: solo `@playwright/test`.
