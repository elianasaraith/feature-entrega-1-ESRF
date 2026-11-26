## Why

T01 ("Gestión de propiedades") es el primer ticket de negocio y el punto de partida de todo el sistema: sin propiedades no hay crédito, contrato ni flujo financiero. La fundación (`Propiedad` en Prisma con sus CHECK en PostgreSQL) y T12 (autenticación) ya están archivadas; falta la API y la UI que permitan operar la cartera.

## What Changes

- API REST de propiedades: listar, consultar detalle, crear y editar (`GET/POST /api/propiedades`, `GET/PUT /api/propiedades/[id]`). Sin eliminación.
- Validación de entrada con Zod, específica de `Propiedad` y espejo de las restricciones de PostgreSQL (incluye fechas calendario reales).
- Servicio de propiedades (`server/services/`) y errores de dominio traducidos a HTTP en un único punto.
- Páginas `/propiedades` (listado), detalle, alta y edición, protegidas por la sesión existente.
- Cada Route Handler invoca `requireSession()` (defensa en profundidad).
- Ajuste mínimo sobre T12 (defecto real): hoy `proxy.ts` redirige a `/login` también las solicitudes a `/api/*`, así que un endpoint nunca respondería 401. Las rutas `/api/*` sin sesión pasarán a recibir 401 JSON; las páginas siguen redirigiendo y `/api/auth/*` no cambia.
- `zod` pasa a dependencia directa (ya existe como transitiva).

## Capabilities

### New Capabilities
- `property-management`: listar, consultar, crear y editar propiedades con validación y protección de sesión.

### Modified Capabilities
- `single-user-auth`: "Protección global de rutas sin sesión" distingue páginas (redirect a login) de `/api/*` (401 JSON).

## Impact

- Código nuevo: `server/schemas/`, `server/services/`, `server/errors.ts`, `app/api/propiedades/`, `app/propiedades/`; `app/page.tsx` enlaza al listado.
- Cambio en T12: `auth.config.ts` (callback `authorized`) y prueba en `tests/auth/proxy.test.ts`.
- Ajustes necesarios para completar `npm run build`, sin cambio de comportamiento:
  - `proxy.ts`: se exporta `proxy` con identificador simple (`const { auth } = NextAuth(...); export const proxy = auth;`) porque `next build` no reconoce el export por desestructuración.
  - `app/page.tsx`: la lectura de sesión (`auth()`) pasa a un componente interno dentro de `<Suspense>`, requerido por `cacheComponents`.
- `package.json`: dependencia `zod`; el glob de `npm test` se amplía a `tests/**/*.test.ts`.
- Sin migraciones ni cambios en `schema.prisma`; los datos existentes no se tocan.
- Fuera de alcance: eliminación, créditos, arriendos, documentos, unicidad de número de departamento, cálculos financieros.
