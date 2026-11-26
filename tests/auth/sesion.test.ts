import { test } from "node:test";
import assert from "node:assert/strict";
import type { JWT } from "next-auth/jwt";
import { SESION_SEGUNDOS, authConfig } from "../../auth.config";

// Callback `jwt`: expiración ABSOLUTA de 8 horas desde el inicio de sesión. Auth.js
// vuelve a firmar el JWT al leer la sesión (renovación deslizante), así que `maxAge` solo
// no basta: el límite lo impone `authTime`.
type Jwt = (p: { token: JWT; user?: { id: string } }) => JWT | null;
const jwt = authConfig.callbacks!.jwt as unknown as Jwt;
const ahora = () => Math.floor(Date.now() / 1000);

test("la sesión dura 8 horas", () => {
  assert.equal(SESION_SEGUNDOS, 8 * 3600);
  assert.equal(authConfig.session?.maxAge, 8 * 3600);
});

test("al iniciar sesión se registra el instante de autenticación", () => {
  const token = jwt({ token: {} as JWT, user: { id: "u" } });
  assert.ok(token && typeof token.authTime === "number");
});

test("dentro de las 8 horas la sesión sigue válida; pasadas, es no autenticada aunque haya actividad", () => {
  assert.ok(jwt({ token: { authTime: ahora() - 7 * 3600 } as JWT }));
  assert.equal(jwt({ token: { authTime: ahora() - 9 * 3600 } as JWT }), null);
});

test("un token anterior al cambio (sin authTime) se invalida: su iat se reinicia en cada lectura y lo haría renovable", () => {
  assert.equal(jwt({ token: { iat: ahora() - 60 } as JWT }), null);
  assert.equal(jwt({ token: { iat: ahora() - 10 * 3600 } as JWT }), null);
  assert.equal(jwt({ token: {} as JWT }), null);
});
