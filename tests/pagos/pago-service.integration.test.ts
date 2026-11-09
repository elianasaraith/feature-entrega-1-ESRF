import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createPagoService } from "../../server/services/pago-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { NotFoundError, UnprocessableError } from "../../server/errors";
import { abonoInputSchema } from "../../server/schemas/abono";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import { contratoCrearSchema, montoCrearSchema } from "../../server/schemas/contrato";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { resolveTestDatabase } from "../setup/test-db";

// Integración de T06 (abonos y estado derivado) contra PostgreSQL real. Solo
// corre con TEST_DATABASE_URL explícita y distinta de DATABASE_URL/DIRECT_URL
// (tests/setup/test-db.ts); si no, se omite. Cada prueba borra únicamente lo que
// creó, por id (abonos → pagos → montos → contratos → arrendatarios →
// propiedades). Datos ficticios.
const { url: testUrl, skip } = resolveTestDatabase();

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const arrendatarios = createArrendatarioService(prisma);
const contratos = createContratoService(prisma);
const service = createPagoService(prisma);
const propiedadesCreadas: string[] = [];
const arrendatariosCreados: string[] = [];
// Contrato 2026-01-01 a 2026-12-31, día esperado 5: con REF se sincronizan ene–jun.
const REF = "2026-06-15";

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const filas = await prisma.contratoArriendo.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true, arrendatarioId: true },
    });
    const ids = filas.map((c) => c.id);
    if (ids.length) {
      await prisma.abonoArriendo.deleteMany({ where: { pagoEsperado: { contratoId: { in: ids } } } });
      await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: ids } } });
      await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: ids } } });
      await prisma.contratoArriendo.deleteMany({ where: { id: { in: ids } } });
    }
    arrendatariosCreados.push(...filas.map((c) => c.arrendatarioId));
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  if (arrendatariosCreados.length) {
    await prisma.arrendatario.deleteMany({ where: { id: { in: arrendatariosCreados } } });
  }
  await prisma.$disconnect();
});

async function nuevoEscenario() {
  const prop = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-PAGO-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(prop.id);
  const arr = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Arrendatario Ficticio" }));
  arrendatariosCreados.push(arr.id);
  const contrato = await contratos.crear(
    prop.id,
    contratoCrearSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      diaEsperadoPago: 5,
      arrendatarioId: arr.id,
      montoMensualClp: "600000",
    }),
    REF
  );
  await contratos.sincronizarPagos(prop.id, contrato.id, REF);
  const pagos = await service.listarPagos(prop.id, contrato.id, REF);
  return { propiedad: prop.id, contrato: contrato.id, pagos };
}

const abono = (montoClp: string | number, fechaRecepcion: string, medio?: string) =>
  abonoInputSchema.parse({ montoClp, fechaRecepcion, medio });

const pagoDe = async (e: { propiedad: string; contrato: string }, periodo: string, hoy = REF) => {
  const p = (await service.listarPagos(e.propiedad, e.contrato, hoy)).find((x) => x.periodo === periodo);
  assert.ok(p, `pago ${periodo}`);
  return p;
};

test("listar pagos: estado derivado sin escribir; sin abonos, vencidos o pendientes según hoy", { skip }, async () => {
  const e = await nuevoEscenario();
  assert.equal(e.pagos.length, 6);
  assert.equal((await pagoDe(e, "2026-03-01")).estado, "VENCIDO");
  // El mismo pago, consultado antes de su fecha esperada, está PENDIENTE.
  assert.equal((await pagoDe(e, "2026-03-01", "2026-03-05")).estado, "PENDIENTE");
  assert.equal((await pagoDe(e, "2026-06-01", "2026-06-05")).estado, "PENDIENTE");
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperado: { contratoId: e.contrato } } }), 0);
});

test("listar sobre un contrato sin pagos sincronizados → lista vacía y no escribe", { skip }, async () => {
  const prop = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-PAGO-2",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(prop.id);
  const arr = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Arrendatario Ficticio" }));
  arrendatariosCreados.push(arr.id);
  const c = await contratos.crear(
    prop.id,
    contratoCrearSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      diaEsperadoPago: 5,
      arrendatarioId: arr.id,
      montoMensualClp: "600000",
    }),
    REF
  );
  assert.deepEqual(await service.listarPagos(prop.id, c.id, REF), []);
  assert.equal(await prisma.pagoEsperado.count({ where: { contratoId: c.id } }), 0);
});

test("alta: un abono parcial, luego otro que completa (AC1/AC2)", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-04-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(200000, "2026-04-03", "Transferencia"), REF);
  assert.equal(a.montoClp, "200000");
  assert.equal(a.medio, "Transferencia");

  let p = await pagoDe(e, "2026-04-01");
  assert.equal(p.estado, "VENCIDO");
  assert.equal(p.vencidoConAbonosParciales, true);
  assert.equal(p.recibidoClp, "200000");
  assert.equal(p.saldoPendienteClp, "400000");

  await service.crearAbono(e.propiedad, e.contrato, pago.id, abono("400000", "2026-04-06"), REF);
  p = await pagoDe(e, "2026-04-01");
  assert.equal(p.estado, "PAGADO");
  assert.equal(p.fechaCompletitud, "2026-04-06");
  assert.equal(p.pagadoConAtraso, true);
  assert.equal(p.abonos.length, 2);
  assert.deepEqual((await service.listarAbonos(e.propiedad, e.contrato, pago.id)).map((x) => x.fechaRecepcion), [
    "2026-04-03",
    "2026-04-06",
  ]);
});

test("parcial sin vencer → PARCIALMENTE_PAGADO", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-06-01");
  await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(100000, "2026-06-02"), "2026-06-03");
  const p = await pagoDe(e, "2026-06-01", "2026-06-03");
  assert.equal(p.estado, "PARCIALMENTE_PAGADO");
  assert.equal(p.saldoPendienteClp, "500000");
});

test("sobrepago (CL14): se acepta, PAGADO y saldo 0", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-02-01");
  await service.crearAbono(e.propiedad, e.contrato, pago.id, abono("620000", "2026-02-04"), REF);
  const p = await pagoDe(e, "2026-02-01");
  assert.equal(p.estado, "PAGADO");
  assert.equal(p.recibidoClp, "620000");
  assert.equal(p.saldoPendienteClp, "0");
  assert.equal(p.pagadoConAtraso, false);
});

test("alta con monto <= 0 o fecha futura → 422 y no persiste (hoy = fecha permitida)", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-05-01");
  for (const input of [abono(0, "2026-05-02"), abono(-1, "2026-05-02"), abono(1000, "2026-06-16")]) {
    await assert.rejects(service.crearAbono(e.propiedad, e.contrato, pago.id, input, REF), UnprocessableError);
  }
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperadoId: pago.id } }), 0);
  // La fecha igual a hoy sí se acepta.
  await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(1000, REF), REF);
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperadoId: pago.id } }), 1);
});

test("edición: cambia monto, fecha y medio y recalcula estado y completitud", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-03-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, pago.id, abono("600000", "2026-03-04"), REF);
  assert.equal((await pagoDe(e, "2026-03-01")).estado, "PAGADO");

  const editado = await service.editarAbono(
    e.propiedad, e.contrato, pago.id, a.id, abono("450000", "2026-03-10", "Depósito"), REF
  );
  assert.equal(editado.montoClp, "450000");
  assert.equal(editado.fechaRecepcion, "2026-03-10");
  assert.equal(editado.medio, "Depósito");
  assert.equal(editado.pagoEsperadoId, pago.id);
  let p = await pagoDe(e, "2026-03-01");
  assert.equal(p.estado, "VENCIDO");
  assert.equal(p.vencidoConAbonosParciales, true);
  assert.equal(p.saldoPendienteClp, "150000");

  // Subir de nuevo el monto con una fecha tardía → PAGADO con atraso.
  await service.editarAbono(e.propiedad, e.contrato, pago.id, a.id, abono("600000", "2026-03-12"), REF);
  p = await pagoDe(e, "2026-03-01");
  assert.equal(p.estado, "PAGADO");
  assert.equal(p.fechaCompletitud, "2026-03-12");
  assert.equal(p.pagadoConAtraso, true);
});

test("edición inválida → 422 y el abono conserva sus valores; inexistente → 404", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-03-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(300000, "2026-03-04"), REF);
  await assert.rejects(
    service.editarAbono(e.propiedad, e.contrato, pago.id, a.id, abono(0, "2026-03-04"), REF),
    UnprocessableError
  );
  await assert.rejects(
    service.editarAbono(e.propiedad, e.contrato, pago.id, a.id, abono(1000, "2026-12-31"), REF),
    UnprocessableError
  );
  const fila = await prisma.abonoArriendo.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(fila.montoClp.toString(), "300000");
  await assert.rejects(
    service.editarAbono(e.propiedad, e.contrato, pago.id, "00000000-0000-4000-8000-000000000000", abono(1, "2026-03-04"), REF),
    NotFoundError
  );
});

test("eliminación física: el pago vuelve a VENCIDO/PENDIENTE sin el abono", { skip }, async () => {
  const e = await nuevoEscenario();
  const pago = await pagoDe(e, "2026-03-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(600000, "2026-03-04"), REF);
  assert.equal((await pagoDe(e, "2026-03-01")).estado, "PAGADO");

  await service.eliminarAbono(e.propiedad, e.contrato, pago.id, a.id);
  assert.equal(await prisma.abonoArriendo.count({ where: { id: a.id } }), 0);
  const p = await pagoDe(e, "2026-03-01");
  assert.equal(p.estado, "VENCIDO");
  assert.equal(p.vencidoConAbonosParciales, false);
  assert.equal(p.fechaCompletitud, null);
  assert.equal((await pagoDe(e, "2026-03-01", "2026-03-05")).estado, "PENDIENTE");
  await assert.rejects(service.eliminarAbono(e.propiedad, e.contrato, pago.id, a.id), NotFoundError);
});

test("pertenencia: contrato/pago/abono de otro padre → 404 sin leer ni modificar", { skip }, async () => {
  const e1 = await nuevoEscenario();
  const e2 = await nuevoEscenario();
  const p1 = await pagoDe(e1, "2026-03-01");
  const p2 = await pagoDe(e2, "2026-03-01");
  const a1 = await service.crearAbono(e1.propiedad, e1.contrato, p1.id, abono(100000, "2026-03-04"), REF);

  // Pago de otro contrato.
  await assert.rejects(service.crearAbono(e1.propiedad, e1.contrato, p2.id, abono(1, "2026-03-04"), REF), NotFoundError);
  await assert.rejects(service.listarAbonos(e1.propiedad, e1.contrato, p2.id), NotFoundError);
  // Contrato de otra propiedad.
  await assert.rejects(service.listarPagos(e1.propiedad, e2.contrato, REF), NotFoundError);
  await assert.rejects(service.crearAbono(e2.propiedad, e1.contrato, p1.id, abono(1, "2026-03-04"), REF), NotFoundError);
  // Abono de otro pago.
  await assert.rejects(service.editarAbono(e2.propiedad, e2.contrato, p2.id, a1.id, abono(1, "2026-03-04"), REF), NotFoundError);
  await assert.rejects(service.eliminarAbono(e2.propiedad, e2.contrato, p2.id, a1.id), NotFoundError);
  // Ids que no son UUID.
  await assert.rejects(service.listarPagos(e1.propiedad, "x", REF), NotFoundError);
  await assert.rejects(service.listarAbonos("x", e1.contrato, p1.id), NotFoundError);

  const intacto = await prisma.abonoArriendo.findUniqueOrThrow({ where: { id: a1.id } });
  assert.equal(intacto.montoClp.toString(), "100000");
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperadoId: p2.id } }), 0);
});

test("reajuste retroactivo conserva abonos: CL12 vencido, CL13 no vencido, y baja de monto", { skip }, async () => {
  const e = await nuevoEscenario();
  const marzo = await pagoDe(e, "2026-03-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, marzo.id, abono(300000, "2026-03-02"), REF);
  await service.crearAbono(e.propiedad, e.contrato, marzo.id, abono(300000, "2026-03-08"), REF);
  const junio = await pagoDe(e, "2026-06-01");
  await service.crearAbono(e.propiedad, e.contrato, junio.id, abono(600000, "2026-06-01"), "2026-06-02");
  assert.equal((await pagoDe(e, "2026-03-01")).estado, "PAGADO");

  // Reajuste a 630.000 desde marzo (retroactivo).
  await contratos.registrarMonto(
    e.propiedad, e.contrato,
    montoCrearSchema.parse({ montoMensualClp: "630000", vigenteDesdePeriodo: "2026-03" })
  );
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperadoId: marzo.id } }), 2);
  const m = await pagoDe(e, "2026-03-01");
  assert.equal(m.estado, "VENCIDO"); // CL12
  assert.equal(m.vencidoConAbonosParciales, true);
  assert.equal(m.saldoPendienteClp, "30000");
  assert.equal(m.fechaCompletitud, null);

  // CL13: el pago de junio (fecha 06-05) consultado antes de vencer.
  const j = await pagoDe(e, "2026-06-01", "2026-06-04");
  assert.equal(j.estado, "PARCIALMENTE_PAGADO");
  assert.equal(j.saldoPendienteClp, "30000");

  assert.equal(await prisma.abonoArriendo.count({ where: { id: a.id } }), 1);
});

test("un reajuste que baja el esperado adelanta la fecha de completitud y conserva abonos (CL14)", { skip }, async () => {
  const e = await nuevoEscenario();
  const marzo = await pagoDe(e, "2026-03-01");
  await service.crearAbono(e.propiedad, e.contrato, marzo.id, abono(300000, "2026-03-02"), REF);
  await service.crearAbono(e.propiedad, e.contrato, marzo.id, abono(300000, "2026-03-08"), REF);
  let m = await pagoDe(e, "2026-03-01");
  assert.equal(m.fechaCompletitud, "2026-03-08");
  assert.equal(m.pagadoConAtraso, true);

  // Nuevo monto 300.000 desde febrero: rige también en marzo.
  await contratos.registrarMonto(
    e.propiedad, e.contrato,
    montoCrearSchema.parse({ montoMensualClp: "300000", vigenteDesdePeriodo: "2026-02" })
  );
  m = await pagoDe(e, "2026-03-01");
  assert.equal(m.montoEsperadoClp, "300000");
  assert.equal(m.estado, "PAGADO");
  assert.equal(m.fechaCompletitud, "2026-03-02");
  assert.equal(m.pagadoConAtraso, false);
  assert.equal(m.recibidoClp, "600000");
  assert.equal(m.abonos.length, 2);
});

test("alta, edición y baja de abonos no sincronizan ni modifican pagos esperados", { skip }, async () => {
  const e = await nuevoEscenario();
  const antes = await prisma.pagoEsperado.findMany({ where: { contratoId: e.contrato }, orderBy: { periodo: "asc" } });
  const pago = await pagoDe(e, "2026-03-01");
  const a = await service.crearAbono(e.propiedad, e.contrato, pago.id, abono(1000, "2026-03-04"), "2026-09-01");
  await service.editarAbono(e.propiedad, e.contrato, pago.id, a.id, abono(2000, "2026-03-04"), "2026-09-01");
  await service.eliminarAbono(e.propiedad, e.contrato, pago.id, a.id);
  await service.listarPagos(e.propiedad, e.contrato, "2026-09-01");
  const despues = await prisma.pagoEsperado.findMany({ where: { contratoId: e.contrato }, orderBy: { periodo: "asc" } });
  assert.equal(despues.length, antes.length);
  assert.deepEqual(
    despues.map((p) => [p.id, p.montoEsperadoClp.toString(), p.updatedAt.getTime()]),
    antes.map((p) => [p.id, p.montoEsperadoClp.toString(), p.updatedAt.getTime()])
  );
});
