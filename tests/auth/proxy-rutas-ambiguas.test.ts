import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

// Archivo aparte: `proxy-seguridad.test.ts` importa módulos internos de Next para evaluar el
// matcher, lo que altera el runtime que Auth.js necesita para las llamadas directas al proxy.
type ProxyFn = (request: NextRequest) => Promise<Response | undefined>;
const llamar = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  (proxy as unknown as ProxyFn)(new NextRequest(new URL(url), init));

test("rutas ambiguas: el parser de URL normaliza /api/auth/.. antes del matcher, que ya no lo excluye", async () => {
  assert.equal(new URL("http://localhost:3000/api/auth/../propiedades").pathname, "/api/propiedades");
  assert.equal(new URL("http://localhost:3000/api/auth/%2e%2e/propiedades").pathname, "/api/propiedades");
  const r = await llamar("http://localhost:3000/api/auth/../propiedades", { method: "POST", headers: { origin: "https://evil.example" } });
  assert.equal(r?.status, 403);
});
