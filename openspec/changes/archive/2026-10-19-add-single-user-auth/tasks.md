## 1. Dependencias

- [x] 1.1 Instalar `next-auth` fijando la versión exacta de la beta v5 ("Auth.js"), no un rango `^`/`beta` suelto
- [x] 1.2 Instalar `argon2`

## 2. Modelo y migración `usuario`

- [x] 2.1 Declarar el modelo `Usuario` en `schema.prisma` (`id UUID`, `email` único, `passwordHash` mapeado a `password_hash`, timestamps), espejo de `docs/data-model.md` §4.1
- [x] 2.2 Generar y aplicar la migración incremental para la tabla `usuario`, sin modificar las migraciones de `Propiedad` ya aplicadas — confirmado por el usuario: migración `add_usuario` aplicada en su máquina

## 3. Variables de entorno

- [x] 3.1 Agregar `AUTH_SECRET`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` a `.env.example` (incremental, solo nombres)
- [x] 3.2 Documentar en `.env` local los valores reales para desarrollo (no versionado) — evidencia indirecta: `npm run db:seed:user` creó el usuario leyendo `SEED_USER_EMAIL`/`SEED_USER_PASSWORD`, y la advertencia `MissingSecret` desapareció, confirmando `AUTH_SECRET` también presente

## 4. Configuración de Auth.js (separada en dos archivos)

- [x] 4.1 Crear `auth.config.ts`: configuración ligera de next-auth v5, sin importar Prisma ni `argon2` — solo lo necesario para verificar una sesión JWT ya emitida
- [x] 4.2 Crear `auth.ts`: `NextAuth({...authConfig, providers: [...]})`, agregando el proveedor de credenciales sobre la configuración ligera
- [x] 4.3 Implementar `authorize()` en `auth.ts`: busca el usuario por `email`, verifica la contraseña con `argon2.verify()` contra `passwordHash`, devuelve el usuario o `null`
- [x] 4.4 Confirmar que no se fija ningún `maxAge` personalizado — se usa el valor por defecto de la librería

## 5. Protección global de rutas

- [x] 5.1 Crear `proxy.ts` en la raíz, exportando con el nombre `proxy` (o `default`) el `auth` construido a partir de `auth.config.ts` — nunca `auth.ts` completo (ver §4), y nunca un export llamado `middleware`
- [x] 5.2 Configurar el matcher/condición para excluir `/login` y los assets estáticos

## 6. Helper de comprobación de sesión para Route Handlers

- [x] 6.1 Implementar un helper que use `await auth()` sin argumentos (forma correcta de Auth.js v5 para Route Handlers; pasar un `Request` explícito invoca por error la rama de middleware) de la configuración completa (`auth.ts`) para resolver la sesión y devuelva la sesión o una `Response` 401
- [x] 6.2 No conectar este helper a ningún endpoint de negocio ni crear ningún endpoint HTTP solo para ejercitarlo — queda disponible para que T01 lo use

## 7. Login y logout

- [x] 7.1 Crear la pantalla de login en `app/(auth)/login/` con un formulario que invoque el proveedor de credenciales
- [x] 7.2 Implementar la acción de cierre de sesión (logout) usando el mecanismo de next-auth v5

## 8. Seed del usuario único

- [x] 8.1 Agregar al `prisma/seed.ts` existente un bloque independiente para el usuario único, sin modificar el bloque de propiedades ficticias
- [x] 8.2 Si `SEED_USER_EMAIL` y `SEED_USER_PASSWORD` están ambas ausentes, omitir el bloque sin error
- [x] 8.3 Si solo una de las dos está presente, lanzar un error claro y detener el script
- [x] 8.4 Si ambas están presentes y no existe ningún usuario, crearlo con la contraseña hasheada en Argon2id
- [x] 8.5 Si ambas están presentes y el usuario ya existe, no modificarlo (conservar sus credenciales)

## 9. Pruebas automatizadas mínimas

- [x] 9.1 Agregar el script `npm run test` (`node --require ./tests/setup/stub-server-only.cjs --import tsx --test`) sin ninguna dependencia nueva de testing; el stub de `server-only` es necesario solo para este script, no afecta `dev`/`build`/`start` (ver design.md)
- [x] 9.2 Prueba: credenciales válidas → `verifyCredentials()` (extraída de `authorize()` para poder probarla de forma aislada) devuelve el usuario — ejecutada y aprobada en la máquina del usuario (`npm run test`: 4/4 aprobadas)
- [x] 9.3 Prueba: credenciales inválidas / email inexistente → `verifyCredentials()` devuelve `null` — ejecutada y aprobada en la máquina del usuario (`npm run test`: 4/4 aprobadas)
- [x] 9.4 Prueba: ruta protegida sin sesión → `proxy.ts` responde con redirect a `/login`
- [ ] 9.5 Prueba: helper de sesión invocado directamente sin sesión → devuelve 401 — **omitida deliberadamente**, igual que 9.6: `requireSession()` usa `await auth()` sin argumentos (forma correcta y recomendada por Auth.js v5 para Route Handlers), que depende del contexto de petición de Next.js y no se puede invocar de forma aislada fuera de un servidor real; se verificará cuando T01 conecte el helper a un Route Handler
- [ ] 9.6 Prueba: logout → una solicitud posterior ya no se reconoce como autenticada — **omitida deliberadamente** (requeriría reconstruir el flujo CSRF de next-auth dentro de la prueba unitaria); cubierta por la verificación manual 10.3

## 10. Verificación end-to-end manual

- [x] 10.1 Confirmar login con credenciales correctas e incorrectas — confirmado: correctas funcionan, incorrectas muestran "Email o contraseña incorrectos"
- [x] 10.2 Confirmar que cualquier ruta protegida sin sesión redirige a `/login` — confirmado por el usuario
- [x] 10.3 Confirmar que el logout invalida la sesión — confirmado: tras logout, acceso directo a `http://localhost:3000/` redirige a `/login` (la sesión quedó realmente invalidada, no solo la navegación de la UI)
- [x] 10.4 Verificar la idempotencia del seed del usuario sin arriesgar las propiedades existentes — **alcance ajustado deliberadamente**: en vez de `npm run db:seed` dos veces (duplicaría las 3 propiedades, ya que ese bloque nunca se exigió idempotente y es fuera de alcance de T12), se corrió `npm run db:seed:user` dos veces. Resultado: segunda corrida reconoce que el usuario ya existe, sin error; `usuario` se mantiene en 1 registro; `propiedad` se mantiene en 3 (no tocada, confirmando que el script no tiene ningún camino hacia esa tabla). El `password_hash` permanece igual por construcción: el único camino que lo escribe (`prisma.usuario.create`) solo se ejecuta cuando `usuarioExistente === 0`, y el conteo se mantuvo en 1 con el log "ya existe" — ese camino no se ejecutó, así que no hay ninguna operación que pudiera haberlo cambiado.
