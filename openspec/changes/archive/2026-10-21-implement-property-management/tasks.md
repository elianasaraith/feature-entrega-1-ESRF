## 1. Preparación

- [x] 1.1 Declarar `zod` como dependencia directa (versión ya instalada, fijada) y ampliar el glob de `npm test` a `tests/**/*.test.ts`

## 2. Ajuste de T12: 401 en `/api/*`

- [x] 2.1 Modificar el callback `authorized` de `auth.config.ts` para devolver 401 JSON en `/api/*` sin sesión; páginas siguen redirigiendo
- [x] 2.2 Ampliar `tests/auth/proxy.test.ts`: `/api/propiedades` sin sesión → 401 JSON; página sin sesión → 307 `/login`

## 3. Validación

- [x] 3.1 Crear `server/schemas/propiedad.ts` con las reglas de design.md (incluida fecha calendario real y CLP sin decimales)
- [x] 3.2 Pruebas unitarias del esquema: válido, estacionamiento/bodega ausentes y vacíos, superficie/monto ≤ 0, CLP con decimales, exceso de precisión, `2026-02-30`, formato de fecha inválido

## 4. Servicio y errores

- [x] 4.1 Crear `server/errors.ts` (`NotFoundError`, traducción única a HTTP 400/404/500)
- [x] 4.2 Crear `server/services/propiedad-service.ts` (`listar`, `obtener`, `crear`, `actualizar`) con serialización de Decimal y fecha
- [x] 4.3 Pruebas de integración del servicio (exigen `TEST_DATABASE_URL` explícita y distinta de la BD de desarrollo; sin ella se omiten; 6/6 verificadas contra `realtytrack_test`): alta con y sin estacionamiento/bodega, actualización, `obtener` inexistente → `NotFoundError`; filas propias con prefijo, borradas por id en `finally`; sin `TRUNCATE`, seed completo ni `deleteMany` sin filtro por id

## 5. Route Handlers

- [x] 5.1 `app/api/propiedades/route.ts` (GET, POST): `requireSession()` → Zod → servicio → traducción de errores
- [x] 5.2 `app/api/propiedades/[id]/route.ts` (GET, PUT), sin DELETE

## 6. UI

- [x] 6.1 Páginas `app/propiedades/` (listado, detalle) leyendo del servicio, rutas dinámicas
- [x] 6.2 `PropiedadForm` compartido y páginas `nueva` y `[id]/editar` (fetch a la API, `router.push` + `router.refresh`, errores por campo)
- [x] 6.3 Enlazar `app/page.tsx` a `/propiedades`

## 7. Verificación

- [x] 7.1 `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`
- [x] 7.2 Manual con `npm run dev`: curl sin cookie → 401 en los 4 endpoints; con sesión → 200/201/400/404; DELETE → 405; flujo UI listar → detalle → crear → editar; las 3 propiedades existentes siguen intactas — evidencia manual confirmada: 401 JSON sin sesión en `GET` y `POST /api/propiedades` y en `GET` y `PUT /api/propiedades/:id`; 404 en id inexistente; 405 en `DELETE` con sesión; flujo UI y validaciones. Automatizado solo el 401 a nivel de proxy (`tests/auth/proxy.test.ts`)
- [x] 7.3 Registrar los prompts relevantes en `prompts.md` (máx. 3 por sección); confirmar que `docs/` y `readme.md` no requieren cambios de diseño
