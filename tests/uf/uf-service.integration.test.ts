import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { createUfService } from "../../server/uf/uf-service";
import type { ProveedorUf, ResultadoUf } from "../../server/uf/proveedor";
import { resolveTestDatabase } from "../setup/test-db";

// Integración contra PostgreSQL real; solo con TEST_DATABASE_URL (ver
// tests/setup/test-db.ts). Usa períodos de 1990 y borra únicamente esos.
const { url: testUrl, skip } = resolveTestDatabase();
const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });

const PERIODOS = ["1990-01", "1990-02", "1990-03", "1990-04"];
const FECHAS = PERIODOS.map((p) => new Date(`${p}-01T00:00:00.000Z`));

async function limpiar() {
  await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS } } });
}

beforeEach(async () => {
  if (!skip) await limpiar();
});
after(async () => {
  if (skip) return;
  await limpiar();
  await prisma.$disconnect();
});

function dobleProveedor(respuestas: Record<string, ResultadoUf | (() => ResultadoUf)>) {
  const llamadas: string[] = [];
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha) {
      llamadas.push(fecha);
      const r = respuestas[fecha];
      if (!r) return { tipo: "sin-datos" };
      return typeof r === "function" ? r() : r;
    },
  };
  return { proveedor, llamadas };
}
const ok = (fecha: string, valor: string): ResultadoUf => ({
  tipo: "ok",
  valorClp: new Prisma.Decimal(valor),
  fechaValor: fecha,
});
const silencio = () => {};

test("primera consulta persiste con fecha_valor, fuente y obtenido_en", { skip }, async () => {
  const { proveedor, llamadas } = dobleProveedor({ "1990-01-01": ok("1990-01-01", "100.50") });
  const svc = createUfService(prisma, proveedor, silencio);
  const r = await svc.obtenerValores(["1990-01"]);
  assert.deepEqual(llamadas, ["1990-01-01"]);
  assert.deepEqual(r.get("1990-01"), {
    periodo: "1990-01",
    valorClp: "100.50",
    fechaValor: "1990-01-01",
    fuente: "doble-pruebas",
  });
  const fila = await prisma.valorUfPeriodo.findUniqueOrThrow({ where: { periodo: FECHAS[0] } });
  assert.equal(fila.fechaValor.toISOString().slice(0, 10), "1990-01-01");
  assert.ok(Math.abs(Date.now() - fila.obtenidoEn.getTime()) < 60_000);
});

test("período almacenado: no consulta al proveedor", { skip }, async () => {
  const a = dobleProveedor({ "1990-01-01": ok("1990-01-01", "100.50") });
  await createUfService(prisma, a.proveedor, silencio).obtenerValores(["1990-01"]);
  const b = dobleProveedor({});
  const r = await createUfService(prisma, b.proveedor, silencio).obtenerValores(["1990-01"]);
  assert.deepEqual(b.llamadas, []);
  assert.equal(r.get("1990-01")?.valorClp, "100.50");
});

test("el proveedor cambia después de almacenar: la fila no cambia", { skip }, async () => {
  const a = dobleProveedor({ "1990-01-01": ok("1990-01-01", "100.50") });
  await createUfService(prisma, a.proveedor, silencio).obtenerValores(["1990-01"]);
  const b = dobleProveedor({ "1990-01-01": ok("1990-01-01", "999.99") });
  const r = await createUfService(prisma, b.proveedor, silencio).obtenerValores(["1990-01"]);
  assert.equal(r.get("1990-01")?.valorClp, "100.50");
  assert.deepEqual(b.llamadas, []);
  const fila = await prisma.valorUfPeriodo.findUniqueOrThrow({ where: { periodo: FECHAS[0] } });
  assert.equal(fila.valorClp.toFixed(2), "100.50");
  assert.equal(fila.fuente, "doble-pruebas");
});

test("consultas concurrentes: una fila, mismo valor, sin error", { skip }, async () => {
  let n = 0;
  const { proveedor } = dobleProveedor({
    "1990-02-01": () => ok("1990-02-01", `${200 + ++n}.00`), // cada llamada devuelve otro valor
  });
  const svc = createUfService(prisma, proveedor, silencio);
  const resultados = await Promise.all(
    Array.from({ length: 6 }, () => svc.obtenerValores(["1990-02"])),
  );
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: FECHAS[1] } }), 1);
  const almacenado = (await prisma.valorUfPeriodo.findUniqueOrThrow({ where: { periodo: FECHAS[1] } }))
    .valorClp.toFixed(2);
  for (const r of resultados) assert.equal(r.get("1990-02")?.valorClp, almacenado);
});

test("serie vacía y error del proveedor: no persisten ni usan otro período", { skip }, async () => {
  // 1990-01 almacenado; 1990-02 sin datos; 1990-03 con error.
  await createUfService(
    prisma,
    dobleProveedor({ "1990-01-01": ok("1990-01-01", "100.50") }).proveedor,
    silencio,
  ).obtenerValores(["1990-01"]);
  const logs: string[] = [];
  const { proveedor } = dobleProveedor({
    "1990-03-01": { tipo: "error", motivo: "HTTP 500" },
  });
  const svc = createUfService(prisma, proveedor, (m) => logs.push(m));
  const r = await svc.obtenerValores(["1990-02", "1990-03"]);
  assert.equal(r.size, 0);
  assert.equal(r.has("1990-02"), false);
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: { in: FECHAS.slice(1, 3) } } }), 0);
  assert.equal(logs.length, 1);
});

test("proveedor caído con valor almacenado: usa el almacenado; mezcla de períodos", { skip }, async () => {
  await createUfService(
    prisma,
    dobleProveedor({ "1990-01-01": ok("1990-01-01", "100.50") }).proveedor,
    silencio,
  ).obtenerValores(["1990-01"]);
  const caido: ProveedorUf = {
    fuente: "x",
    async obtener() {
      throw new Error("boom");
    },
  };
  const r = await createUfService(prisma, caido, silencio).obtenerValores(["1990-01", "1990-04", "1990-01"]);
  assert.equal(r.get("1990-01")?.valorClp, "100.50");
  assert.equal(r.has("1990-04"), false);
});

test("respuesta inconsistente del proveedor (otra fecha) no se persiste", { skip }, async () => {
  const { proveedor } = dobleProveedor({ "1990-01-01": ok("1990-01-02", "100.50") });
  const r = await createUfService(prisma, proveedor, silencio).obtenerValores(["1990-01"]);
  assert.equal(r.size, 0);
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: FECHAS[0] } }), 0);
});

test("CHECK de la tabla: valor no positivo y período que no es día 1", { skip }, async () => {
  const insertar = (periodo: string, valor: string) =>
    prisma.$executeRawUnsafe(
      `INSERT INTO valor_uf_periodo (periodo, valor_clp, fecha_valor, fuente) VALUES ($1::date, $2::numeric, $1::date, 'test')`,
      periodo,
      valor,
    );
  await assert.rejects(insertar("1990-01-01", "0"));
  await assert.rejects(insertar("1990-01-15", "10.00"));
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: { in: FECHAS } } }), 0);
});
