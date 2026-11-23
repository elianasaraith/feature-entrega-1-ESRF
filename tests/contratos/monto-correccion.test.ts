import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { pagosQueCambian } from "../../server/domain/contrato-monto";
import { NotFoundError, UnprocessableError } from "../../server/errors";
import { montoCorregirSchema, montoCrearSchema } from "../../server/schemas/contrato";
import { createContratoService } from "../../server/services/contrato-service";

// Corrección y eliminación guardada de montos, con un doble de Prisma en memoria.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PROP = U(1);
const CONTRATO = U(2);
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

type Monto = { id: string; contratoId: string; montoMensualClp: string; vigenteDesdePeriodo: Date; motivo: string | null; createdAt: Date };
type Pago = { id: string; contratoId: string; periodo: Date; montoEsperadoClp: string; abonos: { id: string }[] };

// Montos: inicial desde 2026-01 (500.000) y reajuste desde 2026-04 (600.000).
function escenario(abonosEn: string[] = []) {
  const montos: Monto[] = [
    { id: U(10), contratoId: CONTRATO, montoMensualClp: "500000", vigenteDesdePeriodo: d("2026-01-01"), motivo: "monto inicial", createdAt: d("2026-01-01") },
    { id: U(11), contratoId: CONTRATO, montoMensualClp: "600000", vigenteDesdePeriodo: d("2026-04-01"), motivo: "reajuste", createdAt: d("2026-04-01") },
  ];
  const meses = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const pagos: Pago[] = meses.map((m, i) => ({
    id: U(100 + i),
    contratoId: CONTRATO,
    periodo: d(`${m}-01`),
    montoEsperadoClp: i < 3 ? "500000" : "600000",
    abonos: abonosEn.includes(m) ? [{ id: U(900 + i) }] : [],
  }));
  const tx = {
    $executeRaw: async () => 1,
    contratoArriendo: { findFirst: async () => ({ id: CONTRATO, fechaInicio: d("2026-01-01"), fechaTermino: d("2026-12-31") }) },
    contratoMonto: {
      findMany: async () => montos.map((m) => ({ ...m })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Monto> }) => {
        const m = montos.find((x) => x.id === where.id) as Monto;
        Object.assign(m, data);
        return m;
      },
      create: async ({ data }: { data: { contratoId: string; montoMensualClp: string; vigenteDesdePeriodo: Date; motivo: string } }) => {
        const nuevo: Monto = { id: U(20 + montos.length), createdAt: new Date(), ...data };
        montos.push(nuevo);
        return nuevo;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        montos.splice(montos.findIndex((x) => x.id === where.id), 1);
      },
    },
    pagoEsperado: {
      findMany: async ({ where }: { where: { periodo: { gte: Date } } }) => pagos.filter((p) => p.periodo >= where.periodo.gte),
      update: async ({ where, data }: { where: { id: string }; data: { montoEsperadoClp: string } }) => {
        (pagos.find((p) => p.id === where.id) as Pago).montoEsperadoClp = data.montoEsperadoClp;
      },
    },
  };
  const prisma = {
    propiedad: { findUnique: async () => ({ id: PROP }) },
    $transaction: async <T,>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  };
  return { servicio: createContratoService(prisma as unknown as PrismaClient), montos, pagos };
}
const esperados = (pagos: Pago[]) => pagos.map((p) => p.montoEsperadoClp);

test("pagosQueCambian solo devuelve los pagos cuyo monto cambia", () => {
  const filas = [
    { vigenteDesdePeriodo: "2026-01-01", montoMensualClp: "500000" },
    { vigenteDesdePeriodo: "2026-04-01", montoMensualClp: "650000" },
  ];
  const pagos = [
    { id: "a", periodo: "2026-03-01", montoEsperadoClp: "500000" },
    { id: "b", periodo: "2026-04-01", montoEsperadoClp: "600000" },
    { id: "c", periodo: "2026-05-01", montoEsperadoClp: "650000" },
  ];
  assert.deepEqual(pagosQueCambian(filas, pagos), [{ id: "b", periodo: "2026-04-01", montoNuevo: "650000" }]);
});

test("corregir un reajuste sin abonos actualiza fila y pagos de su rango", async () => {
  const { servicio, montos, pagos } = escenario();
  const r = await servicio.corregirMonto(PROP, CONTRATO, U(11), montoCorregirSchema.parse({ montoMensualClp: "650000" }));
  assert.equal(r.monto.montoMensualClp, "650000");
  assert.equal(r.pagosActualizados, 3);
  assert.equal(montos[1].montoMensualClp, "650000");
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "650000", "650000", "650000"]);
});

test("corregir el reajuste no toca períodos anteriores, aunque tengan abonos", async () => {
  const { servicio, pagos } = escenario(["2026-01", "2026-02", "2026-03"]);
  await servicio.corregirMonto(PROP, CONTRATO, U(11), montoCorregirSchema.parse({ montoMensualClp: "650000" }));
  assert.deepEqual(esperados(pagos).slice(0, 3), ["500000", "500000", "500000"]);
});

test("corregir con abonos en un pago afectado: 422 y no cambia nada", async () => {
  const { servicio, montos, pagos } = escenario(["2026-05"]);
  await assert.rejects(
    servicio.corregirMonto(PROP, CONTRATO, U(11), montoCorregirSchema.parse({ montoMensualClp: "650000" })),
    (e) => e instanceof UnprocessableError && e.message.includes("2026-05")
  );
  assert.equal(montos[1].montoMensualClp, "600000");
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "600000"]);
  assert.equal(pagos[4].abonos.length, 1);
});

test("corregir el monto inicial afecta solo hasta el siguiente reajuste", async () => {
  const { servicio, pagos } = escenario(["2026-05"]); // abono en un período regido por el reajuste: no afectado
  const r = await servicio.corregirMonto(PROP, CONTRATO, U(10), montoCorregirSchema.parse({ montoMensualClp: "520000" }));
  assert.equal(r.pagosActualizados, 3);
  assert.deepEqual(esperados(pagos), ["520000", "520000", "520000", "600000", "600000", "600000"]);
});

test("un monto que rige pagos con abonos y no cambia se acepta (sin efecto)", async () => {
  const { servicio } = escenario(["2026-02"]);
  const r = await servicio.corregirMonto(PROP, CONTRATO, U(10), montoCorregirSchema.parse({ montoMensualClp: "500000", motivo: "nota" }));
  assert.equal(r.pagosActualizados, 0);
  assert.equal(r.monto.motivo, "nota");
});

test("eliminar un reajuste sin abonos devuelve sus pagos al monto anterior", async () => {
  const { servicio, montos, pagos } = escenario();
  const r = await servicio.eliminarMonto(PROP, CONTRATO, U(11));
  assert.deepEqual(r, { eliminado: true, pagosActualizados: 3 });
  assert.equal(montos.length, 1);
  assert.deepEqual(esperados(pagos), Array(6).fill("500000"));
});

test("eliminar un reajuste con abonos en su rango: 422 y no cambia nada", async () => {
  const { servicio, montos, pagos } = escenario(["2026-04"]);
  await assert.rejects(servicio.eliminarMonto(PROP, CONTRATO, U(11)), UnprocessableError);
  assert.equal(montos.length, 2);
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "600000"]);
});

test("el monto inicial no se puede eliminar", async () => {
  const { servicio, montos } = escenario();
  await assert.rejects(servicio.eliminarMonto(PROP, CONTRATO, U(10)), UnprocessableError);
  assert.equal(montos.length, 2);
});

test("monto inexistente o id inválido: 404", async () => {
  const { servicio } = escenario();
  const input = montoCorregirSchema.parse({ montoMensualClp: "1" });
  await assert.rejects(servicio.corregirMonto(PROP, CONTRATO, U(99), input), NotFoundError);
  await assert.rejects(servicio.corregirMonto(PROP, CONTRATO, "x", input), NotFoundError);
  await assert.rejects(servicio.eliminarMonto(PROP, CONTRATO, U(99)), NotFoundError);
});

test("el esquema exige un entero positivo", () => {
  for (const mal of ["0", "-5", "abc", "1.5", ""]) assert.ok(!montoCorregirSchema.safeParse({ montoMensualClp: mal }).success, mal);
});

// ---------- registrarMonto: misma protección que corregir/eliminar ----------
const reajuste = (periodo: string, monto: string) => montoCrearSchema.parse({ montoMensualClp: monto, vigenteDesdePeriodo: periodo });

test("registrar un reajuste que cambiaría un pago con abonos: 422, sin fila nueva ni cambios", async () => {
  const { servicio, montos, pagos } = escenario(["2026-05"]);
  await assert.rejects(
    servicio.registrarMonto(PROP, CONTRATO, reajuste("2026-05", "700000")),
    (e) => e instanceof UnprocessableError && e.message.includes("2026-05")
  );
  assert.equal(montos.length, 2);
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "600000"]);
  assert.equal(pagos[4].abonos.length, 1);
});

test("un reajuste que solo cambia pagos sin abonos se aplica (los abonos previos no bloquean)", async () => {
  const { servicio, montos, pagos } = escenario(["2026-02", "2026-04"]); // abonos fuera del rango afectado desde 2026-06
  const fila = await servicio.registrarMonto(PROP, CONTRATO, reajuste("2026-06", "700000"));
  assert.equal(fila.montoMensualClp, "700000");
  assert.equal(montos.length, 3);
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "700000"]);
});

test("un reajuste que no altera el monto esperado de un pago con abonos no lo bloquea", async () => {
  const { servicio, montos, pagos } = escenario(["2026-05"]);
  await servicio.registrarMonto(PROP, CONTRATO, reajuste("2026-05", "600000")); // igual al vigente
  assert.equal(montos.length, 3);
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "600000"]);
});

test("el reajuste hacia adelante no toca los períodos anteriores aunque tengan abonos", async () => {
  const { servicio, pagos } = escenario(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  await servicio.registrarMonto(PROP, CONTRATO, reajuste("2026-06", "650000"));
  assert.deepEqual(esperados(pagos), ["500000", "500000", "500000", "600000", "600000", "650000"]);
});
