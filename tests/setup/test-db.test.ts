import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoDe, resolveTestDatabase } from "./test-db";

// Sin BD ni conexión: solo análisis de cadenas de conexión ficticias.
const dev = "postgresql://app:secreto1@db.example.com:5432/realtytrack?sslmode=require";

const resolver = (test: string | undefined, extra: Record<string, string> = {}) =>
  resolveTestDatabase({ TEST_DATABASE_URL: test, DATABASE_URL: dev, ...extra });

test("sin TEST_DATABASE_URL se omite", () => {
  assert.match(String(resolveTestDatabase({}).skip), /no definida/);
  assert.match(String(resolver(undefined).skip), /no definida/);
});

test("URL idéntica a DATABASE_URL o DIRECT_URL se omite", () => {
  assert.match(String(resolver(dev).skip), /misma base y schema que DATABASE_URL/);
  assert.match(
    String(resolveTestDatabase({ TEST_DATABASE_URL: dev, DIRECT_URL: dev }).skip),
    /misma base y schema que DIRECT_URL/
  );
});

test("misma base con parámetros distintos se omite", () => {
  const otra = "postgresql://app:secreto1@db.example.com/realtytrack?connection_limit=1&pgbouncer=true";
  assert.match(String(resolver(otra).skip), /misma base/);
});

test("misma base con usuario y contraseña distintos se omite", () => {
  const otra = "postgresql://otro:otraclave@db.example.com:5432/realtytrack";
  assert.match(String(resolver(otra).skip), /misma base/);
});

test("puerto por defecto, host en mayúsculas y postgres:// equivalen", () => {
  assert.match(String(resolver("postgres://x:y@DB.EXAMPLE.COM:5432/realtytrack").skip), /misma base/);
});

test("host pooler y host directo de la misma base se consideran iguales", () => {
  const directo = "postgresql://u:p@ep-abc-123.sa-east-1.aws.neon.tech/realtytrack";
  const pooler = "postgresql://u:p@ep-abc-123-pooler.sa-east-1.aws.neon.tech/realtytrack";
  assert.match(String(resolveTestDatabase({ TEST_DATABASE_URL: pooler, DIRECT_URL: directo }).skip), /misma base/);
});

test("misma base en otro schema es un destino distinto", () => {
  const a = "postgresql://app:x@db.example.com/realtytrack?schema=test";
  assert.equal(resolver(a).skip, false);
  assert.match(String(resolver("postgresql://app:x@db.example.com/realtytrack?schema=public").skip), /misma base/);
});

test("bases diferentes con el mismo usuario se aceptan", () => {
  const bdPruebas = "postgresql://app:secreto1@db.example.com:5432/realtytrack_test?sslmode=require";
  assert.equal(resolver(bdPruebas).skip, false);
  assert.equal(resolver(bdPruebas, { DIRECT_URL: dev }).skip, false);
});

test("distinto host o distinto puerto se acepta", () => {
  assert.equal(resolver("postgresql://app:x@otro.example.com:5432/realtytrack").skip, false);
  assert.equal(resolver("postgresql://app:x@db.example.com:5433/realtytrack").skip, false);
});

test("URL de pruebas inválida se omite", () => {
  for (const invalida of ["no es una url", "mysql://u:p@h/db", "postgresql://u:p@db.example.com", "postgresql://u:p@db.example.com/"]) {
    assert.match(String(resolver(invalida).skip), /inválida/, invalida);
  }
});

test("URL de desarrollo inválida: no puede comprobarse, se omite", () => {
  assert.match(String(resolver("postgresql://app:x@db.example.com/realtytrack_test", { DATABASE_URL: "basura" }).skip), /DATABASE_URL inválida/);
  assert.match(String(resolver("postgresql://app:x@db.example.com/realtytrack_test", { DIRECT_URL: "basura" }).skip), /DIRECT_URL inválida/);
});

test("el motivo de omisión no filtra credenciales", () => {
  for (const r of [resolver(dev), resolver("basura")]) {
    assert.doesNotMatch(String(r.skip), /secreto1|app:/);
  }
});

test("destinoDe no considera usuario ni contraseña", () => {
  assert.deepEqual(destinoDe("postgresql://a:b@h.example.com/db"), destinoDe("postgresql://c:d@h.example.com:5432/db"));
});
