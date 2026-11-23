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

// T10 grupo 5: equivalentes en CLP del crédito. PostgreSQL real solo con
// TEST_DATABASE_URL (tests/setup/test-db.ts). La UF viene de un doble (sin red)
// y los períodos usados son de 1991: solo se borran esas filas y las creadas aquí.
const { url: testUrl, skip } = resolveTestDatabase();
const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const registros = createCreditoRegistroService(prisma);
const propiedadesCreadas: string[] = [];
const HOY = "1991-05-20";
const FECHAS_UF = ["1991-02", "1991-04", "1991-05"].map((p) => new Date(`${p}-01T00:00:00.000Z`));

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
  "1991-02-01": ok("1991-02-01", "1000.00"),
  "1991-04-01": ok("1991-04-01", "2000.00"),
  "1991-05-01": ok("1991-05-01", "3000.00"),
};

beforeEach(async () => {
  if (!skip) await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
});

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const creditos = await prisma.creditoHipotecario.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    await prisma.creditoRegistroMensual.deleteMany({
      where: { creditoId: { in: creditos.map((c) => c.id) } },
    });
    await prisma.creditoHipotecario.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
  await prisma.$disconnect();
});

type Opciones = { fechaOtorgamiento?: string; saldoInicialUf?: string; saldoMensual?: string };

async function crearCredito(uf: UfService | undefined, o: Opciones = {}) {
  const propiedad = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-EQ-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(propiedad.id);
  const servicio = createCreditoService(prisma, uf);
  await servicio.crear(
    propiedad.id,
    creditoInputSchema.parse({
      banco: "Banco Ficticio",
      cuotaContractualUf: "10",
      tasaInteresAnual: "4.1250",
      numeroCuotasTotal: 240,
      diaVencimiento: 5,
      fechaOtorgamiento: o.fechaOtorgamiento,
      saldoInicialUf: o.saldoInicialUf,
    })
  );
  if (o.saldoMensual) {
    await registros.crear(
      propiedad.id,
      registroMensualCrearSchema.parse({ periodo: "1991-04", saldoPendienteUf: o.saldoMensual })
    );
  }
  return { id: propiedad.id, servicio };
}

const todo: Opciones = { fechaOtorgamiento: "1991-02-10", saldoInicialUf: "5", saldoMensual: "7" };

test("cuota con la UF del mes actual, saldo inicial con la de fechaOtorgamiento y último saldo con la de su período", { skip }, async () => {
  const { llamadas, uf } = doble(completas);
  const { id, servicio } = await crearCredito(uf, todo);
  const r = await servicio.obtenerConEquivalentes(id, HOY);

  assert.deepEqual(r.cuotaContractualClp, {
    valorClp: "30000", ufClp: "3000.00", fechaReferencia: "1991-05-01",
  });
  assert.deepEqual(r.saldoInicialClp, {
    valorClp: "5000", ufClp: "1000.00", fechaReferencia: "1991-02-01",
  });
  assert.deepEqual(r.ultimoSaldo, {
    periodo: "1991-04",
    saldoPendienteUf: "7",
    equivalenteClp: { valorClp: "14000", ufClp: "2000.00", fechaReferencia: "1991-04-01" },
  });
  // Montos originales en UF intactos y una sola consulta por período.
  assert.equal(r.cuotaContractualUf, "10");
  assert.equal(r.saldoInicialUf, "5");
  assert.deepEqual([...llamadas].sort(), ["1991-02-01", "1991-04-01", "1991-05-01"]);
});

test("sin fechaOtorgamiento: saldo inicial null sin usar otro mes; la cuota sigue calculada", { skip }, async () => {
  const { llamadas, uf } = doble(completas);
  const { id, servicio } = await crearCredito(uf, { saldoInicialUf: "5" });
  const r = await servicio.obtenerConEquivalentes(id, HOY);
  assert.equal(r.fechaOtorgamiento, null);
  assert.equal(r.saldoInicialClp, null);
  assert.equal(r.cuotaContractualClp?.valorClp, "30000");
  assert.deepEqual(llamadas, ["1991-05-01"]);
});

test("sin saldo inicial o sin saldo mensual: equivalentes null y sin consultas innecesarias", { skip }, async () => {
  const { llamadas, uf } = doble(completas);
  const { id, servicio } = await crearCredito(uf, { fechaOtorgamiento: "1991-02-10" });
  const r = await servicio.obtenerConEquivalentes(id, HOY);
  assert.equal(r.saldoInicialUf, null);
  assert.equal(r.saldoInicialClp, null);
  assert.equal(r.ultimoSaldo, null);
  assert.deepEqual(llamadas, ["1991-05-01"]);
});

test("proveedor sin datos: equivalentes null y montos en UF intactos", { skip }, async () => {
  const { uf } = doble({});
  const { id, servicio } = await crearCredito(uf, todo);
  const r = await servicio.obtenerConEquivalentes(id, HOY);
  assert.equal(r.cuotaContractualClp, null);
  assert.equal(r.saldoInicialClp, null);
  assert.equal(r.ultimoSaldo?.equivalenteClp, null);
  assert.equal(r.ultimoSaldo?.saldoPendienteUf, "7");
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: { in: FECHAS_UF } } }), 0);
});

test("proveedor caído o con error: la consulta principal funciona y los equivalentes son null", { skip }, async () => {
  for (const respuesta of ["lanza", { tipo: "error", motivo: "HTTP 500" } as ResultadoUf] as const) {
    const { uf } = doble({
      "1991-02-01": respuesta, "1991-04-01": respuesta, "1991-05-01": respuesta,
    });
    const { id, servicio } = await crearCredito(uf, todo);
    const r = await servicio.obtenerConEquivalentes(id, HOY);
    assert.equal(r.banco, "Banco Ficticio");
    assert.equal(r.cuotaContractualClp, null);
    assert.equal(r.saldoInicialClp, null);
    assert.equal(r.ultimoSaldo?.equivalenteClp, null);
  }
});

test("falla del servicio de UF (p. ej. BD): equivalentes null, sin lanzar", { skip }, async () => {
  const roto = {
    obtenerValores: async () => {
      throw new Error("tabla no disponible");
    },
  } as unknown as UfService;
  const { id, servicio } = await crearCredito(roto, todo);
  const original = console.error;
  console.error = silencio;
  try {
    const r = await servicio.obtenerConEquivalentes(id, HOY);
    assert.equal(r.cuotaContractualClp, null);
    assert.equal(r.ultimoSaldo?.saldoPendienteUf, "7");
  } finally {
    console.error = original;
  }
});

test("período almacenado previamente: no se consulta al proveedor ni cambia el valor", { skip }, async () => {
  const primera = doble(completas);
  const { id, servicio } = await crearCredito(primera.uf, todo);
  await servicio.obtenerConEquivalentes(id, HOY);

  const segunda = doble({ "1991-05-01": ok("1991-05-01", "9999.00") });
  const otro = createCreditoService(prisma, segunda.uf);
  const r = await otro.obtenerConEquivalentes(id, HOY);
  assert.deepEqual(segunda.llamadas, []);
  assert.equal(r.cuotaContractualClp?.ufClp, "3000.00");
  assert.equal(r.cuotaContractualClp?.valorClp, "30000");
});

test("compatibilidad: sin servicio de UF los campos previos no cambian y los equivalentes son null", { skip }, async () => {
  const { id, servicio } = await crearCredito(undefined, todo);
  const base = await servicio.obtenerPorPropiedad(id);
  const r = await servicio.obtenerConEquivalentes(id, HOY);
  const { cuotaContractualClp, saldoInicialClp, ultimoSaldo, ...previos } = r;
  assert.deepEqual(previos, base);
  assert.equal(cuotaContractualClp, null);
  assert.equal(saldoInicialClp, null);
  assert.equal(ultimoSaldo?.equivalenteClp, null);
  assert.equal(ultimoSaldo?.periodo, "1991-04");
});
