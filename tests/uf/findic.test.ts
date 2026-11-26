import { test } from "node:test";
import assert from "node:assert/strict";
import { createFindicProveedor } from "../../server/uf/findic";

// Sin red: `fetch` se sustituye por un doble. Valores reales solo en formato.
function proveedorCon(fetchFn: typeof fetch, timeoutMs?: number) {
  return createFindicProveedor({ baseUrl: "https://uf.test/api/uf/", fetchFn, timeoutMs });
}

function responder(cuerpo: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(cuerpo), { status });
}

const serie = (fecha: string, valor: unknown) => ({ serie: [{ fecha, valor }] });

test("respuesta válida: Decimal exacto y fecha en dd-mm-yyyy", async () => {
  let urlLlamada = "";
  const p = proveedorCon(async (url) => {
    urlLlamada = String(url);
    return new Response(JSON.stringify(serie("2026-03-01", 39796.31)));
  });
  const r = await p.obtener("2026-03-01");
  assert.equal(urlLlamada, "https://uf.test/api/uf/01-03-2026");
  assert.equal(r.tipo, "ok");
  if (r.tipo === "ok") {
    assert.equal(r.valorClp.toFixed(2), "39796.31");
    assert.equal(r.fechaValor, "2026-03-01");
  }
  assert.equal(p.fuente, "findic.cl");
});

test("serie vacía: sin datos", async () => {
  const r = await proveedorCon(responder({ serie: [] })).obtener("2030-01-01");
  assert.deepEqual(r, { tipo: "sin-datos" });
});

test("fecha distinta de la solicitada se rechaza", async () => {
  const r = await proveedorCon(responder(serie("2026-03-02", 39796.31))).obtener("2026-03-01");
  assert.equal(r.tipo, "error");
});

test("valores inválidos: 0, negativo, nulo, texto, más de 2 decimales, fuera de rango", async () => {
  for (const valor of [0, -1, null, "39796.31", 39796.311, 1e10, 1e21]) {
    const r = await proveedorCon(responder(serie("2026-03-01", valor))).obtener("2026-03-01");
    assert.equal(r.tipo, "error", `valor ${String(valor)}`);
  }
});

test("estructura inválida o serie con más de un elemento", async () => {
  for (const cuerpo of [{}, { serie: "x" }, { serie: [null] }, { serie: [{ fecha: "2026-03-01" }] }]) {
    const r = await proveedorCon(responder(cuerpo)).obtener("2026-03-01");
    assert.equal(r.tipo, "error");
  }
  const dos = { serie: [{ fecha: "2026-03-01", valor: 1 }, { fecha: "2026-03-01", valor: 2 }] };
  assert.equal((await proveedorCon(responder(dos)).obtener("2026-03-01")).tipo, "error");
});

test("error HTTP", async () => {
  const r = await proveedorCon(responder({}, 500)).obtener("2026-03-01");
  assert.equal(r.tipo, "error");
});

test("cuerpo que no es JSON", async () => {
  const r = await proveedorCon(async () => new Response("<html>")).obtener("2026-03-01");
  assert.equal(r.tipo, "error");
});

test("fallo de red", async () => {
  const r = await proveedorCon(async () => {
    throw new TypeError("fetch failed");
  }).obtener("2026-03-01");
  assert.equal(r.tipo, "error");
});

test("timeout: se aborta la consulta y se informa error", async () => {
  const colgado: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  const r = await proveedorCon(colgado, 30).obtener("2026-03-01");
  assert.equal(r.tipo, "error");
});

test("fecha solicitada con formato inválido", async () => {
  const r = await proveedorCon(responder({})).obtener("01-03-2026");
  assert.equal(r.tipo, "error");
});
