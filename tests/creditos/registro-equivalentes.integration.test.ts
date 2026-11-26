import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { creditoInputSchema } from "../../server/schemas/credito";
import { registroMensualCrearSchema } from "../../server/schemas/credito-registro";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import type { ProveedorUf, ResultadoUf } from "../../server/uf/proveedor";
import { createUfService } from "../../server/uf/uf-service";
import type { UfService } from "../../server/uf/uf-service";
import { resolveTestDatabase } from "../setup/test-db";

// T10 grupo 6: equivalentes en CLP del registro mensual. PostgreSQL real solo con
// TEST_DATABASE_URL; UF desde un doble (sin red), con períodos de 1992.
const { url: testUrl, skip } = resolveTestDatabase();
const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const creditos = createCreditoService(prisma);
const propiedadesCreadas: string[] = [];
const FECHAS_UF = ["1992-01", "1992-02", "1992-03", "1992-04"].map(
  (p) => new Date(`${p}-01T00:00:00.000Z`)
);

const silencio = () => {};
const ok = (fecha: string, valor: string): ResultadoUf => ({
  tipo: "ok",
  valorClp: new Prisma.Decimal(valor),
  fechaValor: fecha,
});

function doble(respuestas: Record<string, ResultadoUf | "lanza">) {
  const llamadas: string[] = [];
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha) {
      llamadas.push(fecha);
      const r = respuestas[fecha];
      if (r === "lanza") throw new Error("proveedor caído");
      return r ?? { tipo: "sin-datos" };
    },
  };
  return { llamadas, uf: createUfService(prisma, proveedor, silencio) };
}

const completas = {
  "1992-01-01": ok("1992-01-01", "1000.00"),
  "1992-02-01": ok("1992-02-01", "2000.00"),
  "1992-03-01": ok("1992-03-01", "3000.00"),
};

beforeEach(async () => {
  if (!skip) await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
});

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const cs = await prisma.creditoHipotecario.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    await prisma.creditoRegistroMensual.deleteMany({ where: { creditoId: { in: cs.map((c) => c.id) } } });
    await prisma.creditoHipotecario.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
  await prisma.$disconnect();
});

// 1992-01 saldo 10, 1992-02 solo dividendo, 1992-03 saldo 20 (creados fuera de orden).
async function crearHistorial(uf?: UfService) {
  const propiedad = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-REQ-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(propiedad.id);
  await creditos.crear(
    propiedad.id,
    creditoInputSchema.parse({
      banco: "Banco Ficticio",
      cuotaContractualUf: "10",
      tasaInteresAnual: "4.1250",
      numeroCuotasTotal: 240,
      diaVencimiento: 5,
    })
  );
  const base = createCreditoRegistroService(prisma);
  for (const r of [
    { periodo: "1992-03", saldoPendienteUf: "20" },
    { periodo: "1992-01", saldoPendienteUf: "10" },
    { periodo: "1992-02", dividendoPagadoClp: 400000, fechaPagoDividendo: "1992-02-05" },
  ]) {
    await base.crear(propiedad.id, registroMensualCrearSchema.parse(r));
  }
  return { id: propiedad.id, servicio: createCreditoRegistroService(prisma, uf) };
}

test("cada registro usa la UF de su propio período y el orden se conserva", { skip }, async () => {
  const { llamadas, uf } = doble(completas);
  const { id, servicio } = await crearHistorial(uf);
  const r = await servicio.listarConEquivalentes(id);
  assert.deepEqual(r.map((x) => x.periodo), ["1992-03", "1992-02", "1992-01"]);
  assert.deepEqual(r[0].equivalenteClp, { valorClp: "60000", ufClp: "3000.00", fechaReferencia: "1992-03-01" });
  assert.deepEqual(r[2].equivalenteClp, { valorClp: "10000", ufClp: "1000.00", fechaReferencia: "1992-01-01" });
  assert.equal(r[0].saldoPendienteUf, "20");
  // El registro solo con dividendo no consulta ni muestra UF.
  assert.equal(r[1].equivalenteClp, null);
  assert.equal(r[1].dividendoPagadoClp, "400000");
  assert.deepEqual([...llamadas].sort(), ["1992-01-01", "1992-03-01"]);
});

test("mes sin registro: equivalente null y sin consultar la UF; mes con saldo, equivalente", { skip }, async () => {
  const { llamadas, uf } = doble(completas);
  const { id, servicio } = await crearHistorial(uf);
  const sin = await servicio.obtenerPorPeriodoConEquivalentes(id, "1992-04");
  assert.equal(sin.registrado, false);
  assert.equal(sin.equivalenteClp, null);
  assert.deepEqual(llamadas, []);
  const con = await servicio.obtenerPorPeriodoConEquivalentes(id, "1992-01");
  assert.equal(con.equivalenteClp?.valorClp, "10000");
});

test("proveedor sin datos: equivalentes null y nada persistido", { skip }, async () => {
  const { uf } = doble({});
  const { id, servicio } = await crearHistorial(uf);
  const r = await servicio.listarConEquivalentes(id);
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.equivalenteClp === null));
  assert.equal(r[0].saldoPendienteUf, "20");
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: { in: FECHAS_UF } } }), 0);
});

test("proveedor caído, con error o servicio de UF roto: la consulta principal funciona", { skip }, async () => {
  const roto = {
    obtenerValores: async () => {
      throw new Error("tabla no disponible");
    },
  } as unknown as UfService;
  const casos: UfService[] = [
    doble({ "1992-01-01": "lanza", "1992-03-01": "lanza" }).uf,
    doble({
      "1992-01-01": { tipo: "error", motivo: "HTTP 500" },
      "1992-03-01": { tipo: "error", motivo: "HTTP 500" },
    }).uf,
    roto,
  ];
  const original = console.error;
  console.error = silencio;
  try {
    for (const uf of casos) {
      const { id, servicio } = await crearHistorial(uf);
      const r = await servicio.listarConEquivalentes(id);
      assert.equal(r.length, 3);
      assert.ok(r.every((x) => x.equivalenteClp === null));
      assert.equal(r[2].saldoPendienteUf, "10");
    }
  } finally {
    console.error = original;
  }
});

test("UF previamente almacenada: no se consulta al proveedor ni cambia", { skip }, async () => {
  const primera = doble(completas);
  const a = await crearHistorial(primera.uf);
  await a.servicio.listarConEquivalentes(a.id);
  const segunda = doble({ "1992-01-01": ok("1992-01-01", "9999.00"), "1992-03-01": ok("1992-03-01", "9999.00") });
  const servicio = createCreditoRegistroService(prisma, segunda.uf);
  const r = await servicio.listarConEquivalentes(a.id);
  assert.deepEqual(segunda.llamadas, []);
  assert.equal(r[2].equivalenteClp?.ufClp, "1000.00");
  assert.equal(r[0].equivalenteClp?.ufClp, "3000.00");
});

test("sin servicio de UF: equivalentes null y contratos anteriores intactos", { skip }, async () => {
  const { id, servicio } = await crearHistorial(undefined);
  const base = await servicio.listar(id);
  const conEq = await servicio.listarConEquivalentes(id);
  const sinEquivalente = (x: (typeof conEq)[number]) => {
    const copia: Partial<typeof x> = { ...x };
    delete copia.equivalenteClp;
    return copia;
  };
  assert.deepEqual(conEq.map(sinEquivalente), base);
  assert.ok(conEq.every((x) => x.equivalenteClp === null));
  const uno = await servicio.obtenerPorPeriodo(id, "1992-01");
  const unoConEq = await servicio.obtenerPorPeriodoConEquivalentes(id, "1992-01");
  assert.equal(unoConEq.equivalenteClp, null);
  assert.deepEqual(sinEquivalente(unoConEq), uno);
});
