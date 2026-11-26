## 1. Preparación

- [x] 1.1 Instalar solo `@playwright/test` como dependencia de desarrollo y añadir los scripts `test:e2e`, `test:e2e:db` y `test:e2e:install`
- [x] 1.2 Ignorar en `.gitignore` los artefactos de Playwright (`test-results/`, `playwright-report/`)

## 2. Implementación

- [x] 2.1 Crear `playwright.config.ts` (Chromium, 1 worker, `webServer` con `next dev` en el puerto 3100 y base de pruebas)
- [x] 2.2 Crear `e2e/global-setup.ts` con la guarda de aislamiento, vaciado de tablas y siembra del usuario ficticio
- [x] 2.3 Crear `e2e/flujo-principal.spec.ts` con el flujo principal y la prueba de credenciales inválidas

## 3. Verificación y documentación

- [x] 2.4 Corregir `test:e2e:db` (`scripts/e2e-migrate.ts`) para cargar `.env`, validar la guarda y migrar solo `TEST_DATABASE_URL`
- [x] 2.5 Ampliar a cinco escenarios: `e2e/ayudas.ts`, `e2e/hipoteca.spec.ts`, `e2e/finanzas.spec.ts`, `e2e/arriendos.spec.ts` y `UF_API_BASE_URL` inalcanzable en `playwright.config.ts`


- [x] 3.1 Ejecutar `tsc --noEmit` y ESLint sobre los archivos nuevos
- [x] 3.2 Ejecutar las dos primeras pruebas en local (confirmado por el usuario: 2 passed)
- [x] 2.6 Corregir los cinco escenarios tras la primera ejecución local (radio «Nuevo», nombres accesibles, proveedor de UF simulado `e2e/uf-stub.mjs`, timeouts de `next dev`)
- [ ] 3.3 Ejecutar `npm run test:e2e` en local con los cinco escenarios (no ejecutable en el sandbox; lo confirma el usuario)
- [x] 3.4 Documentar la configuración y ejecución en `readme.md` y registrar el uso de IA en `prompts.md`
