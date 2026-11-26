## Context

`Propiedad` y sus CHECK (`superficie_m2 > 0`, `valor_compra_monto > 0`, CLP sin decimales) ya existen. `requireSession()` existe pero no está conectado a ningún endpoint. `architecture.md` fija: escritura vía REST sin Server Actions, lectura de Server Components llamando al servicio directo, handlers que solo validan + autentican + llaman al servicio + traducen errores (400/401/404/500), Prisma directo sin repositorios. `zod@4.6.5` ya está instalado como transitiva.

## Goals / Non-Goals

**Goals:** CRUD sin borrado de propiedades, validación Zod coherente con la BD, 401 JSON en la API sin sesión, UI mínima, pruebas proporcionadas que no toquen los datos existentes.

**Non-Goals:** eliminación, paginación/filtros, unicidad de `numeroDepartamento`, restricción de fecha futura (no hay regla de negocio confirmada), hipotecas/arriendos/documentos, librerías de formularios o UI.

## Decisions

1. **Endpoints**: `GET/POST /api/propiedades`, `GET/PUT /api/propiedades/[id]`. `PUT` con cuerpo completo (mismo esquema que el alta) en lugar de `PATCH`: la regla cruzada "CLP sin decimales" se valida solo con el cuerpo, sin mezclar estado persistido. Respuestas: 200 / 201 / 400 / 401 / 404 / 500. `id` no UUID → 404.
2. **401 en `/api/*`**: el callback `authorized` de `auth.config.ts` devuelve `Response` 401 JSON cuando la ruta empieza por `/api/` y no hay sesión; el resto sigue como hoy (redirect a `/login`). `/api/auth/*` ya está excluido por el matcher de `proxy.ts` y no cambia. Alternativa descartada: excluir `/api/` del matcher (eliminaría la capa global). `requireSession()` se mantiene en cada handler.
3. **Capas**: `server/schemas/propiedad.ts` (Zod), `server/services/propiedad-service.ts` (`listar`, `obtener`, `crear`, `actualizar`; Prisma directo), `server/errors.ts` (`NotFoundError` y helper único `toHttpResponse` para 400/404/500), handlers delgados.
4. **Zod específico de `Propiedad`** (sin abstracciones genéricas):
   - `numeroDepartamento`: texto con trim, obligatorio.
   - `direccion`, `estacionamiento`, `bodega`: opcionales; vacío/espacios → `null`.
   - `superficieM2`: > 0, máx. 2 decimales, ≤ 999999.99 (`NUMERIC(8,2)`).
   - `valorCompraMonto`: > 0, máx. 4 decimales, ≤ `NUMERIC(14,4)`; entero si la moneda es CLP (`superRefine`).
   - `valorCompraMoneda`: enum `UF | CLP`.
   - `fechaCompra`: `YYYY-MM-DD` que además sea fecha calendario real (se reconstruye con `Date.UTC` y se compara año/mes/día; `2026-02-30` se rechaza).
   - Montos aceptan número o string numérico; se normalizan a string decimal para Prisma (sin pasar por float).
   Los CHECK de PostgreSQL siguen siendo la red de seguridad: una violación que escape a Zod → 500 genérico, sin duplicar lógica en el servicio.
5. **Serialización**: `Decimal` → string; `fechaCompra` → `YYYY-MM-DD`; `createdAt/updatedAt` ISO.
6. **UI**: `app/propiedades/page.tsx` (listado), `[id]/page.tsx` (detalle), `nueva/page.tsx`, `[id]/editar/page.tsx`. Lectura vía servicio en Server Components. Con `cacheComponents` habilitado no se usa `export const dynamic` (incompatible): las lecturas de BD y de `params` se hacen en un componente asíncrono interno envuelto en `<Suspense>`, que es la solución adoptada en listado, detalle y edición, y también en `app/page.tsx` para `auth()`; un `PropiedadForm` Client Component compartido escribe con `fetch` a la API y luego `router.push` + `router.refresh`. Tailwind mínimo, sin cálculos financieros en componentes. `app/page.tsx` enlaza a `/propiedades`.
7. **Pruebas** (`node:test`, sin dependencias nuevas):
   - Unitarias del esquema Zod (sin BD).
   - Integración del servicio contra PostgreSQL real. Exige `TEST_DATABASE_URL` explícita (BD aislada, con `prisma migrate deploy` aplicado). Si no está definida, o coincide con `DATABASE_URL`/`DIRECT_URL`, las pruebas se omiten; nunca usan `DATABASE_URL` como alternativa. Cada prueba crea sus propias filas, registra sus ids y las borra por id. Nunca `TRUNCATE`, `deleteMany` sin filtro por id ni el seed completo; las 3 propiedades existentes no se leen para modificarlas.
   - Proxy: `/api/propiedades` sin sesión → 401 JSON, página sin sesión → 307 `/login`.
   - Solo evidencia manual (sin prueba automatizada): 201/400/404/200 con sesión, 401 JSON en los cuatro endpoints sin sesión y 405 en `DELETE` con sesión (`requireSession()` no se puede invocar fuera del runtime de Next, ya documentado en T12).

## Risks / Trade-offs

- [Cambio en el callback de T12 afecta la protección global] → delta explícito en la spec y prueba de que páginas siguen redirigiendo y `/api/auth/*` queda intacto.
- [Pruebas de integración sobre datos reales] → nunca se ejecutan contra la BD de desarrollo: exigen `TEST_DATABASE_URL` y limpian solo por id propio.
- [Duplicación Zod/CHECK] → aceptada: Zod da 400 con mensajes por campo; el CHECK protege la integridad.
- [Sin unicidad de nº de depto] → el modelo no la define; se anota como supuesto, no se inventa regla.

## Open Questions

Ninguna que bloquee. Supuestos a validar: sin unicidad de `numeroDepartamento` y sin tope de fecha de compra.
