## Context

El repositorio hoy solo tiene el scaffold de Next.js y el modelo `Propiedad` (de `setup-project-foundation`). No existe ningún código de autenticación: ni modelo `usuario`, ni librerías (`next-auth`, `argon2`), ni pantalla de login. `docs/architecture.md` §11 ya fija el mecanismo (Auth.js, credentials provider, JWT, Argon2id, middleware de protección global, alta por seed), y `docs/data-model.md` §4.1 ya define la entidad `usuario`. `docs/work-tickets.md` T12 deriva sus criterios de aceptación directamente de `docs/product.md` §6.7/§7.2, porque T12 no tiene historia de usuario propia.

T01 ("Gestión de propiedades") queda explícitamente diferido hasta que este change esté archivado: no se construye ninguna UI/API de negocio sin autenticación protegiéndola primero.

## Goals / Non-Goals

**Goals:**
- Modelo `usuario` y su migración, espejo exacto de `docs/data-model.md` §4.1.
- Login con email + contraseña del usuario único, vía Auth.js (`next-auth` v5) con proveedor de credenciales y estrategia JWT.
- Contraseña con hash Argon2id — nunca en texto plano.
- Protección global de rutas vía `proxy.ts` (convención vigente en Next.js 16).
- Helper reutilizable de comprobación de sesión para que los futuros Route Handlers de negocio lo invoquen (defensa en profundidad), verificado de forma aislada.
- Cierre de sesión (logout) explícito.
- Alta del usuario único por seed, segura, repetible e idempotente, sin sobrescribir credenciales en corridas posteriores, sin romper el seed de propiedades ficticias ya existente.
- Estrategia mínima de pruebas automatizadas para los puntos anteriores.

**Non-Goals:**
- Registro público, invitaciones, perfiles, roles, recuperación de contraseña — fuera del MVP (`docs/product.md` §6.7, §7.2).
- Rate limiting / bloqueo por intentos fallidos — ningún documento lo exige para T12; posible mejora de seguridad en una entrega posterior.
- Cualquier endpoint de negocio o endpoint HTTP creado solo para probar la autorización — eso se integra en T01, no aquí.
- Cualquier entidad o UI de `Propiedad` — ya existe (fundación) y no se toca.

## Decisions

- **`next-auth@beta` (v5, marca "Auth.js") en vez de `next-auth` v4 estable.** Verificado en el registro de npm: v4 (`4.24.15`) es la marca "NextAuth.js"; la marca **"Auth.js"** que `docs/architecture.md` §11.1 nombra explícitamente, con su API nativa de App Router, solo existe en v5 (`5.0.0-beta.32` al momento de este change). Se fija la versión exacta en `package.json` (no un rango `^`/`beta` suelto), para no absorber cambios de una API todavía inestable sin revisión. Alternativa descartada: v4 — es una marca y un modelo de integración distintos a los que describe la arquitectura.

- **`argon2` (paquete nativo estándar de Node) para Argon2id.** Es el paquete más usado para este algoritmo en Node. Riesgo conocido: es un paquete nativo que compila o descarga un binario — mismo tipo de riesgo que tuvimos con `@prisma/engines` durante la fundación (ver Risks).

- **JWT: duración por defecto de la librería, sin `maxAge` personalizado.** Ningún documento fija una duración de sesión. En vez de inventar un valor (p. ej. "30 días"), se usa el comportamiento estándar de `next-auth` v5 hasta que una necesidad funcional concreta justifique configurarlo explícitamente. Si surge esa necesidad durante el desarrollo, se revisa esta decisión antes de codificarla — no se fija un número arbitrario hoy.

- **Variable de secreto: `AUTH_SECRET`** (nombre nativo de next-auth v5; v4 usaba `NEXTAUTH_SECRET`).

- **`proxy.ts` en la raíz del proyecto, no `middleware.ts`.** Verificado directamente en el código instalado de `next` 16.4.0 (`node_modules/next/dist/build/index.js`): el archivo `middleware.ts` está **deprecado** en Next.js 16 a favor de `proxy.ts` — mismo mecanismo de intercepción de rutas, solo cambia el nombre de archivo que el framework reconoce; Next.js emite advertencia y ofrece un codemod oficial (`middleware-to-proxy`) si detecta el nombre antiguo. `docs/architecture.md` §11.1 describe el *mecanismo* ("middleware que protege todas las rutas salvo la pantalla de acceso"), no el nombre de archivo de una versión de Next.js posterior a cuando se escribió el documento, así que no hay conflicto real en usar `proxy.ts`.
  - **Export esperado**: Next.js 16 busca específicamente una exportación nombrada `proxy`, o en su defecto una exportación `default` — nunca `middleware` (verificado en `node_modules/next/dist/build/analysis/get-page-static-info.js` y en `.../build/templates/middleware.js`: `(isProxy ? mod.proxy : mod.middleware) || mod.default`). Un ejemplo de tutorial de `next-auth` v5 que muestre `export { auth as middleware }` fallaría con `ProxyMissingExportError` si se copia literalmente dentro de `proxy.ts`; el patrón correcto es `export { auth as proxy } from "./auth.config"` (o `export default auth`).
  - **Runtime**: `proxy.ts` **siempre corre en Node.js runtime** en Next.js 16 — no es un default que se pueda cambiar, ni requiere configurarlo. Verificado en `node_modules/next/dist/build/analysis/get-page-static-info.js`: declarar cualquier `runtime` (incluido `'edge'`) dentro de un archivo proxy lanza un error explícito: *"Route segment config is not allowed in Proxy file... Proxy always runs on Node.js runtime."* Edge Runtime **no es una opción** para `proxy.ts`, así que no hay ninguna incompatibilidad de runtime entre `proxy.ts` y dependencias nativas de Node como `argon2` o el motor de `@prisma/client`.

- **Configuración de Auth.js separada en `auth.config.ts` (ligera) y `auth.ts` (completa), aunque el runtime de Node.js ya permitiría una sola.** Dado que `proxy.ts` corre en Node.js runtime (punto anterior), técnicamente podría importar una única configuración completa sin ningún problema de compatibilidad. Se prefiere separar en dos archivos de todos modos:
  - `auth.config.ts`: configuración mínima (sin proveedor de credenciales, sin importar Prisma ni `argon2`) — solo lo necesario para que `NextAuth(authConfig)` pueda resolver/verificar una sesión JWT ya emitida. La usa `proxy.ts`.
  - `auth.ts`: configuración completa — `...authConfig` más el proveedor de credenciales con `authorize()` (Prisma + Argon2id) y la exportación de `handlers`/`signIn`/`signOut` que usan la pantalla de login, el logout y el helper de Route Handlers.
  - **Por qué, si no es por compatibilidad de runtime**: `proxy.ts` se ejecuta en **cada solicitud** a cualquier ruta protegida (no solo en el login). Cargar ahí el cliente de Prisma y `argon2` — que solo hacen falta una vez, durante el `authorize()` del login — aumenta el bundle y el trabajo de cada solicitud sin necesidad. Es además el patrón de configuración dividida que la propia documentación de Auth.js v5 recomienda, independientemente de si el motivo original (compatibilidad con Edge) aplica aquí. Es composición de objetos de JavaScript (`{...authConfig, providers: [...]}`), no una característica específica de una versión de `next-auth`, así que es compatible con cualquier build de la v5 beta que se instale.
  - **Alternativa considerada y descartada**: una configuración única (`auth.ts`) importada directamente por `proxy.ts`. Es viable en Next.js 16 (el runtime ya es Node.js), pero se descarta por el costo de cargar Prisma/Argon2id en cada solicitud a una ruta protegida, no por incompatibilidad.

- **Helper reutilizable de comprobación de sesión para Route Handlers, sin wiring a ningún endpoint todavía.** `docs/architecture.md` §8.2 exige que un Route Handler compruebe la sesión como uno de sus cuatro trabajos. Como ningún Route Handler de negocio existe aún (eso es T01), este change entrega solo el helper, usando `await auth()` **sin argumentos** sobre la configuración completa (`auth.ts`) — la forma documentada y recomendada por Auth.js v5 dentro de Server Components y Route Handlers, que devuelve la sesión o una `Response` 401. No se crea ningún endpoint de prueba ni de negocio para ejercitarlo.
  - **Descartado al implementar**: pasarle un `Request` explícito a `auth(request)` para poder invocarlo en una prueba aislada. Se probó y falla: ese único-argumento invoca la rama de *middleware* de next-auth (`handleAuth`), que espera un `NextRequest` con `.nextUrl` y genera redirects a `/login` — no es la forma de obtener una sesión dentro de un Route Handler, es la misma maquinaria que usa `proxy.ts`. La forma correcta (`auth()` sin argumentos) depende del contexto de petición de Next.js (`next/headers`) y, por lo tanto, no se puede invocar de forma aislada fuera de un servidor real — la misma limitación ya aceptada para el logout (ver Risks). Se verificará cuando T01 conecte el helper a un Route Handler real.

- **Seed del usuario único: crear solo si no existe, nunca `upsert`.** Un `upsert` reescribiría la contraseña en cada corrida de `npm run db:seed`, lo cual el usuario descartó explícitamente. El bloque de seed de auth:
  1. Si `SEED_USER_EMAIL` y `SEED_USER_PASSWORD` están **ambas** ausentes → no hace nada (ni crea, ni falla); el bloque de propiedades ficticias de la fundación sigue ejecutándose sin verse afectado.
  2. Si **solo una** de las dos está presente → lanza un error explícito y detiene el script (configuración a medias es un error del operador).
  3. Si ambas están presentes y **ya existe** una fila en `usuario` → no la toca (no sobrescribe contraseña ni email).
  4. Si ambas están presentes y **no existe** ninguna fila → crea el usuario, hasheando la contraseña con Argon2id antes de guardar.
  Este bloque es independiente del bloque existente de propiedades ficticias dentro de `prisma/seed.ts` — ninguno depende del otro para ejecutarse.

- **Garantía de usuario único, sin mecanismo de base de datos adicional.** No existe ningún endpoint de registro (decisión ya cerrada: fuera de alcance de T12) y el seed es el **único** punto de escritura que crea una fila `usuario`, guardado para crear como máximo una (regla 4 arriba). `authorize()` busca por `email` (`UNIQUE` en `data-model.md` §4.1), no "el primero que encuentre" — así que el comportamiento de login es determinista incluso en un hipotético estado con más de una fila. No se agrega ningún trigger ni constraint especial para forzar una sola fila: sería sobreingeniería dado que no existe ningún otro camino de escritura.

- **Modelo `usuario` en `schema.prisma`**: `id UUID` (`@default(uuid())`, igual que `Propiedad`), `email TEXT @unique`, `passwordHash TEXT` (`@map("password_hash")`), `createdAt`/`updatedAt TIMESTAMPTZ`. Espejo exacto de `data-model.md` §4.1 y de las convenciones de §2 ya usadas en `Propiedad`.

- **Testing: `tsx --test`, cero dependencias nuevas de testing.** `tsx` ya es una devDependency (de la fundación, para `db:seed`/`db:verify`) y ejecuta `node:test`/`node:assert` sobre TypeScript sin framework adicional. Script `npm run test`. Casos cubiertos, bajo `tests/auth/`:
  - Credenciales válidas → `verifyCredentials()` devuelve el usuario (requiere Postgres real).
  - Credenciales inválidas / email inexistente → `verifyCredentials()` devuelve `null` (requiere Postgres real).
  - Ruta protegida sin sesión → `proxy.ts` responde con redirect a `/login` (no requiere Postgres: la verificación de sesión en JWT solo decodifica la cookie).
  - **Omitidos deliberadamente** (requerirían el contexto de petición real de Next.js, no reproducible en una prueba aislada con `tsx --test`): helper de sesión sin sesión → 401; logout → sesión invalidada. Ambos se verifican manualmente (tareas 10.2–10.3) y se automatizarán naturalmente cuando T01 los conecte a un Route Handler/flujo real.
  Las pruebas que requieren Postgres real siguen el mismo patrón que `db:verify` — consistente con el nivel "Integración de servicios" de `docs/architecture.md` §18.

- **Stub de `server-only` exclusivo para `npm run test`, sin tocar la configuración de producción de Next.js.** `server/db/client.ts` y `server/auth/require-session.ts` llevan `import "server-only"` (`docs/architecture.md` §6: módulos de acceso a datos y los que manejan credenciales deben protegerse así) y esa protección se conserva sin excepción. El problema es que `server-only` lanza una excepción incondicional si se ejecuta fuera del bundler de Next.js — funciona en producción porque Next.js reemplaza el paquete por un módulo vacío al compilar para el servidor; `tsx --test` ejecuta estos módulos directamente con Node, sin ese reemplazo, así que sin más la prueba fallaría aunque el código sea correcto. Se agrega `tests/setup/stub-server-only.cjs`, un script de ~10 líneas que parchea `Module._load` para devolver un módulo vacío solo cuando el specifier es `"server-only"`/`"client-only"`, cargado exclusivamente vía `node --require ./tests/setup/stub-server-only.cjs --import tsx --test ...` en el script `test` de `package.json`. Los scripts `dev`/`build`/`start` no lo cargan, así que `next build`/`next dev` siguen resolviendo el paquete real sin cambios.
  - **Alternativas descartadas**: (1) quitar `server-only` de esos módulos — rechazada por el usuario explícitamente, esa protección debe conservarse; (2) omitir esas pruebas y verificarlas solo manualmente — reduciría la cobertura automatizada ya aprobada sin necesidad, dado que existe una solución mínima; (3) usar un framework de mocking (Jest, Vitest) para el stub — introduciría una dependencia de testing nueva para resolver algo que Node ya permite nativamente vía `Module._load`.

## Risks / Trade-offs

- **`next-auth` v5 es software beta** → su API puede cambiar entre versiones beta → Mitigación: versión exacta fijada en `package.json`, sin actualizar sin revisión explícita.

- **`argon2` es un paquete nativo que compila o descarga un binario** → mismo tipo de riesgo que tuvimos con `@prisma/engines` durante la fundación (en el sandbox de esa sesión la descarga vía Node falló por un problema de red específico, aunque `curl` al mismo host funcionó; fuera del sandbox no hubo problema) → Mitigación: se documenta como riesgo conocido; si la instalación falla en un entorno restringido, el workaround ya probado (redirigir `HOME`/`NPM_CONFIG_CACHE`, o instalar fuera del sandbox) aplica igual.

- **`proxy.ts` es una convención muy reciente de Next.js 16** → tutoriales y la documentación pública de `next-auth` v5 beta pueden seguir mostrando `middleware.ts` → Mitigación: ya resuelto arriba (Decisions) con el export exacto verificado contra el código instalado (`proxy` o `default`, nunca `middleware`); no se copia un ejemplo de tutorial sin adaptar el nombre del export.

- **Borrado físico de la única fila `usuario` dejaría a todos sin acceso** → `data-model.md` §2 aplica borrado físico genérico a toda entidad, sin excepción declarada para `usuario` → Mitigación: no se expone ningún `DELETE` de `usuario` en ningún documento ni en este change; se señala como nota, no como riesgo activo.

## Migration Plan

No aplica un plan de despliegue/rollback todavía — Entrega 2 sigue sin despliegue real (`docs/architecture.md` §15: "en Entrega 1 no existe despliegue real"; esto no ha cambiado). La migración de base de datos (`usuario`) se aplica localmente con `prisma migrate dev`, igual que la migración inicial de `Propiedad`.
