import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { proxy, config } from "../../proxy";
import {
  CUERPO_MAXIMO_BYTES,
  esOrigenPermitido,
  excedeLimiteDeCuerpo,
  origenesConfiables,
  requiereVerificacionDeOrigen,
} from "../../server/http/origen";

type ProxyFn = (request: NextRequest) => Promise<Response | undefined>;
const llamar = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  (proxy as unknown as ProxyFn)(new NextRequest(new URL(url), init));
const ID = "00000000-0000-4000-8000-000000000000";
const API = `http://localhost:3000/api/propiedades/${ID}/movimientos`;

const entornoInicial = { NODE_ENV: process.env.NODE_ENV, APP_ORIGINS: process.env.APP_ORIGINS };
afterEach(() => {
  for (const [k, v] of Object.entries(entornoInicial)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
});

test("CSRF: una mutación con Origin ajeno responde 403 antes de comprobar la sesión", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const r = await llamar(API, { method, headers: { origin: "https://evil.example" } });
    assert.equal(r?.status, 403, method);
    assert.deepEqual(await r?.json(), { error: "Origen no permitido" });
  }
});

test("CSRF: sin Origin y sin Sec-Fetch-Site same-origin se rechaza; con same-origin continúa (y sin sesión da 401)", async () => {
  assert.equal((await llamar(API, { method: "POST" }))?.status, 403);
  assert.equal((await llamar(API, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))?.status, 403);
  assert.equal((await llamar(API, { method: "POST", headers: { "sec-fetch-site": "same-origin" } }))?.status, 401);
});

test("CSRF: un Origin confiable continúa su camino normal (sin sesión: 401)", async () => {
  const r = await llamar(API, { method: "POST", headers: { origin: "http://localhost:3000" } });
  assert.equal(r?.status, 401);
});

test("CSRF: GET y HEAD no se verifican", async () => {
  assert.equal((await llamar(API, { method: "GET", headers: { origin: "https://evil.example" } }))?.status, 401);
});

test("CSRF: también se verifican las mutaciones dirigidas a páginas (posibles Server Actions)", async () => {
  const r = await llamar("http://localhost:3000/dashboard", { method: "POST", headers: { origin: "https://evil.example" } });
  assert.equal(r?.status, 403);
});

test("CSRF: /api/auth/* conserva sus propios mecanismos (la verificación de origen del sistema no interviene)", async () => {
  const r = await llamar("http://localhost:3000/api/auth/signout", { method: "POST", headers: { origin: "https://evil.example" } });
  assert.notEqual(r?.status, 403);
  assert.equal(requiereVerificacionDeOrigen("POST", "/api/auth/callback/credentials"), false);
  assert.equal(requiereVerificacionDeOrigen("POST", "/api/authx"), true);
});

test("CSRF: en producción sin APP_ORIGINS toda mutación se rechaza (cierre por defecto); con APP_ORIGINS se aceptan solo esos orígenes", async () => {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "production";
  delete env.APP_ORIGINS;
  assert.equal((await llamar(API, { method: "POST", headers: { origin: "http://localhost:3000" } }))?.status, 403);
  env.APP_ORIGINS = "https://realtytrack.example, https://otra.example/";
  assert.equal((await llamar(API, { method: "POST", headers: { origin: "https://realtytrack.example" } }))?.status, 401);
  assert.equal((await llamar(API, { method: "POST", headers: { origin: "https://evil.example" } }))?.status, 403);
  assert.deepEqual(origenesConfiables({ APP_ORIGINS: "no es url, https://a.example", NODE_ENV: "production" }), ["https://a.example"]);
});

test("origen: lógica pura", () => {
  const permitidos = ["https://a.example"];
  assert.equal(esOrigenPermitido({ origin: "https://a.example", secFetchSite: null }, permitidos), true);
  assert.equal(esOrigenPermitido({ origin: "https://a.example.evil.com", secFetchSite: "same-origin" }, permitidos), false);
  assert.equal(esOrigenPermitido({ origin: "null", secFetchSite: "same-origin" }, permitidos), false);
  assert.equal(esOrigenPermitido({ origin: null, secFetchSite: "same-origin" }, permitidos), true);
  assert.equal(esOrigenPermitido({ origin: null, secFetchSite: null }, permitidos), false);
});

test("tamaño: Content-Length superior a 1 MiB responde 413; un cuerpo normal continúa", async () => {
  const grande = String(CUERPO_MAXIMO_BYTES + 1);
  const r = await llamar(API, { method: "POST", headers: { origin: "http://localhost:3000", "content-length": grande } });
  assert.equal(r?.status, 413);
  const ok = await llamar(API, { method: "POST", headers: { origin: "http://localhost:3000", "content-length": "2048" } });
  assert.equal(ok?.status, 401);
  assert.equal(excedeLimiteDeCuerpo(null), false);
  assert.equal(excedeLimiteDeCuerpo("abc"), false);
});

// --- Matcher exacto, evaluado con el mismo compilador que usa Next.js ----------------
async function regexDelMatcher(): Promise<RegExp> {
  const mod = (await import("next/dist/build/analysis/get-page-static-info.js")) as unknown as Record<string, unknown>;
  const getMiddlewareMatchers = ((mod.getMiddlewareMatchers ?? (mod.default as Record<string, unknown>)?.getMiddlewareMatchers) as (
    m: unknown,
    c: unknown
  ) => { regexp: string }[]);
  const [m] = getMiddlewareMatchers(config.matcher, {});
  return new RegExp(m.regexp);
}

test("matcher: protege todo salvo la pantalla de acceso, /api/auth/, estáticos de Next y favicon", async () => {
  const re = await regexDelMatcher();
  const interceptadas = ["//api/auth/x", "/", "/dashboard", "/propiedades/1", "/api/propiedades", "/api/auth", "/api/authx", "/login-admin", "/login2", "/favicon.ico.bak", "/_next/staticx/a.js", "/loginx/a", "/api/auth-admin"];
  const excluidas = ["/login", "/login/", "/api/auth/session", "/api/auth/callback/credentials", "/_next/static/chunks/a.js", "/_next/image", "/_next/image/x", "/favicon.ico"];
  for (const ruta of interceptadas) assert.ok(re.test(ruta), `debería interceptarse: ${ruta}`);
  for (const ruta of excluidas) assert.ok(!re.test(ruta), `debería excluirse: ${ruta}`);
});

// --- Cobertura de todos los handlers -------------------------------------------------
function archivos(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, acc);
    else acc.push(ruta);
  }
  return acc;
}

test("handlers: solo métodos GET/POST/PUT/PATCH/DELETE; todo no-GET queda bajo la verificación de origen; ningún GET escribe", () => {
  const rutas = archivos(join(process.cwd(), "app/api")).filter((f) => f.endsWith("route.ts") && !f.includes("/auth/"));
  assert.ok(rutas.length >= 20, "se esperan los handlers de la API");
  const permitidos = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
  for (const archivo of rutas) {
    const codigo = readFileSync(archivo, "utf8");
    const metodos = [...codigo.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)].map((m) => m[1]);
    for (const metodo of metodos) {
      assert.ok(permitidos.has(metodo), `${archivo}: método no soportado por la verificación (${metodo})`);
      if (metodo !== "GET") assert.equal(requiereVerificacionDeOrigen(metodo, "/api/x"), true);
    }
    // Un GET no debe invocar operaciones de escritura de los servicios.
    const get = /export\s+async\s+function\s+GET[\s\S]*?\n}\n/.exec(codigo)?.[0] ?? "";
    assert.ok(!/\.(crear|actualizar|eliminar|registrar|sincronizar|solicitarSubida|guardar|upsert)\(/.test(get), `${archivo}: un GET escribe`);
    // Cada handler conserva su propia comprobación de sesión.
    assert.ok(codigo.includes("requireSession"), `${archivo}: falta requireSession`);
  }
});

test("no hay Server Actions sin cobertura (\"use server\")", () => {
  const fuentes = [...archivos(join(process.cwd(), "app")), ...archivos(join(process.cwd(), "server"))].filter((f) => /\.(ts|tsx)$/.test(f));
  for (const f of fuentes) assert.ok(!/^\s*["']use server["']/m.test(readFileSync(f, "utf8")), `${f} declara "use server"`);
});

test("layouts privados: verifican la sesión por sí mismos", () => {
  for (const layout of ["app/dashboard/layout.tsx", "app/propiedades/layout.tsx"]) {
    assert.ok(readFileSync(join(process.cwd(), layout), "utf8").includes("GuardiaSesion"), `${layout} sin guardia de sesión`);
  }
  const guardia = readFileSync(join(process.cwd(), "app/_ui/guardia-sesion.tsx"), "utf8");
  assert.ok(guardia.includes("exigirSesionPagina") && guardia.includes("<Suspense"));
  assert.ok(/redirect\("\/login"\)/.test(readFileSync(join(process.cwd(), "server/auth/sesion-pagina.ts"), "utf8")));
});
