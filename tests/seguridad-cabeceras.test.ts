import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";
import { cabecerasSeguridad, construirCsp, hostAlmacenamiento } from "../server/http/cabeceras";

const R2 = "https://cuenta.r2.cloudflarestorage.com";

test("CSP de producción: sin unsafe-eval, con connect-src limitado al origen propio y al almacenamiento", () => {
  const csp = construirCsp({ produccion: true, s3Endpoint: R2 });
  assert.ok(!csp.includes("unsafe-eval"));
  assert.match(csp, /connect-src 'self' https:\/\/cuenta\.r2\.cloudflarestorage\.com(;|$)/);
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "img-src 'self' data:", "font-src 'self'"]) {
    assert.ok(csp.split("; ").includes(d), `falta ${d}`);
  }
  assert.ok(!/\*|https?:\/\/(?!cuenta\.r2)/.test(csp), "sin comodines ni orígenes externos distintos del almacenamiento");
  assert.ok(!csp.includes("ws:") && !csp.includes("localhost"));
});

test("CSP en desarrollo permite eval y websockets locales (HMR); sin almacenamiento no añade orígenes", () => {
  const dev = construirCsp({ produccion: false, s3Endpoint: null });
  assert.ok(dev.includes("'unsafe-eval'") && dev.includes("ws:"));
  assert.match(construirCsp({ produccion: true }), /connect-src 'self'(;|$)/);
});

test("el host del almacenamiento solo acepta http(s) válidos", () => {
  assert.equal(hostAlmacenamiento(R2 + "/bucket"), R2);
  assert.equal(hostAlmacenamiento("javascript:alert(1)"), null);
  assert.equal(hostAlmacenamiento("no es url"), null);
  assert.equal(hostAlmacenamiento(undefined), null);
});

test("cabeceras de seguridad completas y script-src conserva 'unsafe-inline' documentado", () => {
  const h = Object.fromEntries(cabecerasSeguridad({ produccion: true, s3Endpoint: R2 }).map((c) => [c.key, c.value]));
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(h["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
  assert.match(h["Strict-Transport-Security"], /max-age=\d+/);
  assert.ok(h["Content-Security-Policy"].includes("script-src 'self' 'unsafe-inline'"));
});

test("next.config: sin X-Powered-By, Cache Components activo y cabeceras aplicadas a todas las rutas", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal(nextConfig.cacheComponents, true);
  const reglas = await nextConfig.headers!();
  assert.equal(reglas[0].source, "/:path*");
  assert.ok(reglas[0].headers.some((c) => c.key === "Content-Security-Policy"));
});
