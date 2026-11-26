## Context

La aplicación usa Auth.js (JWT), límite de intentos de login en PostgreSQL, comprobación de `Origin` en mutaciones y Cache Components. El flujo real de UI se revisó en el código: formularios con `<label>` envolventes (selectores por etiqueta), pagos por abonos y dashboard con `region` «Resumen del mes».

## Decisions

- **Servidor**: `next dev` en el puerto 3100 con `DATABASE_URL` y `DIRECT_URL` forzadas a `TEST_DATABASE_URL` (las variables del proceso prevalecen sobre `.env`). Sin build previo y sin tocar la configuración de Next. Requiere que no haya otro `next dev` en este directorio (bloqueo de `.next`).
- **Aislamiento**: `globalSetup` falla si `resolveTestDatabase()` indica omisión o si el nombre de la base no contiene `test` o `e2e`. Nunca usa `DATABASE_URL`.
- **Repetibilidad**: `globalSetup` ejecuta `TRUNCATE … RESTART IDENTITY CASCADE` sobre todas las tablas excepto `_prisma_migrations` y siembra el usuario con `seedUsuario`. Así el total del dashboard es exacto y `login_intento` queda vacío.
- **Rate limiting**: el flujo hace un único login válido (más un intento inválido, 1 de 5 por cuenta); el setup limpia `login_intento`. Sin `VERCEL`, todas las peticiones comparten el cubo de IP `local` (límite 20).
- **Fechas**: «hoy» se calcula en `America/Santiago`, igual que el servidor; el contrato inicia el día 1 del mes actual para que la sincronización cree el pago de ese mes y la fecha de recepción (por defecto hoy) caiga en el mes que muestra el dashboard.
- **Datos**: ficticios y fijos (`E2E-<n>`, arrendatario sintético, credenciales de la constante de prueba, sobreescribibles por entorno). Sin RUT ni datos personales.
- **Selectores**: `getByRole`/`getByLabel`; sin `waitForTimeout`; esperas por aserciones web-first.
- **Escenarios independientes**: cada archivo `*.spec.ts` inicia sesión (`e2e/ayudas.ts`) y crea su propia propiedad con un número de departamento único; ningún escenario depende de otro ni del orden. Dentro de cada uno, los pasos (`test.step`) son secuenciales.
- **Aislamiento financiero**: el flujo principal usa el mes en curso; finanzas usa 2025-03, hipoteca registra su dividendo en 2025-06 y arriendos no registra ingresos. Así las cifras exactas del dashboard de un mes no se contaminan con otros escenarios, aunque compartan base dentro de una ejecución. Todas las fechas de los tres escenarios nuevos son fijas y pasadas.
- **Sin servicios externos**: Playwright levanta `e2e/uf-stub.mjs` (puerto 3101), un proveedor de UF simulado del lado servidor con el formato de findic.cl y valor fijo, y el servidor de pruebas apunta a él con `UF_API_BASE_URL`; no hay red ni cambios en la lógica productiva. No se usa R2.
- **Compilación bajo demanda**: `next dev` compila cada ruta en su primera visita, por lo que los escenarios largos usan un timeout de 90 s por prueba, 15 s para aserciones y 60 s para navegaciones.
- **Arrendatarios globales**: no pertenecen a una propiedad; si ya existe alguno, el formulario de contrato arranca en «Existente». Los escenarios que crean contrato eligen «Nuevo» explícitamente.
- **Páginas ocultas por Cache Components**: las páginas ya visitadas permanecen en el DOM, ocultas, y `getByLabel`/`getByText` también las consideran. Los escenarios nuevos usan `getByRole` con nombre accesible (solo elementos visibles) y acotan los textos a su contenedor (encabezado del dashboard, fila, tarjeta de pago); no usan `.first()`, `.nth()` ni `force`.
- **Nombres accesibles**: el asterisco de obligatorio forma parte del texto de la etiqueta, por lo que para coincidencias exactas se usa el rol y el nombre accesible (`getByRole('textbox', { name })`).

## Risks / Trade-offs

- La base de pruebas se vacía: debe ser exclusiva de pruebas (documentado y protegido por la guarda de nombre).
- No ejecutable en el sandbox (sin puerto local, sin descarga de Chromium ni PostgreSQL): se valida con `tsc` y `eslint`; la ejecución es local.
