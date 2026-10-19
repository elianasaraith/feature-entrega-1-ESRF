import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

// Invoca proxy.ts directamente (sin servidor real) para verificar la
// protección global de rutas. No requiere base de datos: la verificación de
// sesión aquí solo decodifica el JWT de la cookie, no consulta Prisma.
//
// El matcher que excluye /login (config.matcher en proxy.ts) actúa a nivel
// de enrutamiento de Next.js, antes de invocar esta función — por eso no se
// prueba aquí; se verifica manualmente en la tarea 10.2.
//
// `proxy` (= NextAuth(authConfig).auth) acepta un NextRequest en runtime
// cuando Next.js lo invoca como middleware, pero sus tipos declarados no
// exponen esa firma para una llamada directa (ver require-session.ts para
// la misma situación). Se castea explícitamente para esta prueba.
type ProxyFn = (request: NextRequest) => Promise<Response | undefined>;

test("ruta protegida sin sesión redirige a /login", async () => {
  const request = new NextRequest(new URL("http://localhost:3000/"));
  const response = await (proxy as unknown as ProxyFn)(request);

  assert.ok(response, "proxy debería devolver una respuesta de redirect");
  assert.equal(response?.status, 307);
  const location = response?.headers.get("location");
  assert.ok(location, "la respuesta debería incluir un header Location");
  assert.equal(
    new URL(location as string).pathname,
    "/login",
    `esperaba redirect a /login, obtuve: ${location}`
  );
});
