## Why

T12 ("Acceso protegido de usuario único") es un prerrequisito transversal de plataforma: ningún ticket funcional (empezando por T01, "Gestión de propiedades") debe exponerse en producción sin él. La fundación (`setup-project-foundation`) ya dejó lista la primera entidad de negocio (`Propiedad`), pero deliberadamente dejó la autenticación fuera de su alcance. Antes de construir cualquier UI/API de negocio hace falta proteger la aplicación completa detrás de un login de usuario único.

## What Changes

- Modelo `usuario` (email + hash de contraseña) y su migración.
- Auth.js (`next-auth` v5, todavía en beta) con proveedor de credenciales y estrategia JWT.
- Hash de contraseña con Argon2id.
- `proxy.ts` de protección global (convención vigente en Next.js 16; sustituye a `middleware.ts`, deprecado): toda ruta queda protegida salvo la pantalla de acceso.
- Helper reutilizable de comprobación de sesión para que los futuros Route Handlers de negocio exijan sesión antes de delegar al servicio (defensa en profundidad) — sin crear todavía ningún endpoint de negocio; esa integración ocurre en T01.
- Pantalla de login y acción de cierre de sesión (logout).
- Alta del usuario único por seed, sin endpoint de registro, sin sobrescribir credenciales existentes en corridas posteriores.

## Capabilities

### New Capabilities
- `single-user-auth`: acceso protegido de usuario único (login, logout, protección global de rutas, y el mecanismo de defensa en profundidad que los Route Handlers de negocio usarán).

### Modified Capabilities
(ninguna — la única capability existente, `project-foundation`, no cambia sus requirements)

## Impact

- Primera tabla nueva desde la fundación (`usuario`); primeras dependencias de producción nuevas (`next-auth`, `argon2`).
- Primer código de `app/(auth)/` y `proxy.ts` del repositorio.
- No toca el modelo `Propiedad` ni ningún código de T01 (que todavía no existe) — la gestión de propiedades se retoma en su propio change, después de que este quede archivado.
- No crea ningún endpoint de negocio ni endpoint HTTP artificial solo para probar la autorización: el helper de sesión se verifica de forma aislada; su integración real con los endpoints de propiedades es alcance de T01.
- Explícitamente fuera: registro público, invitaciones, perfiles, roles, recuperación de contraseña, rate limiting / bloqueo por intentos fallidos — ninguno de estos está pedido por `product.md` ni por `work-tickets.md` T12.
