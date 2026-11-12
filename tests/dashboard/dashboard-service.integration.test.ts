import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createDashboardService } from "../../server/services/dashboard-service";
import { createMovimientoService } from "../../server/services/movimiento-service";
import { createPagoService } from "../../server/services/pago-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { NotFoundError } from "../../server/errors";
import { abonoInputSchema } from "../../server/schemas/abono";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import { contratoCrearSchema } from "../../server/schemas/contrato";
import { creditoInputSchema } from "../../server/schemas/credito";
import { registroMensualCrearSchema } from "../../server/schemas/credito-registro";
import { movimientoInputSchema } from "../../server/schemas/movimiento";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { resolveTestDatabase } from "../setup/test-db";

// Integración de T09 contra PostgreSQL real. Solo corre con TEST_DATABASE_URL
// explícita y distinta de DATABASE_URL/DIRECT_URL (tests/setup/test-db.ts); si
// no, se omite. Cada prueba crea sus propias propiedades (datos ficticios) y
// `after` borra solo lo creado, por id. Como la BD de pruebas puede contener
// otras propiedades, las aserciones de cartera se hacen sobre las filas de las
// propiedades creadas aquí, y el total se compara con la suma de TODAS las filas.
const { url: testUrl, skip } = resolveTestDatabase();

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const arrendatarios = createArrendatarioService(prisma);
const contratos = createContratoService(prisma);
const pagos = createPagoService(prisma);
const creditos = createCreditoService(prisma);
const registros = createCreditoRegistroService(prisma);
const movimientos = createMovimientoService(prisma);
const service = createDashboardService(prisma);

const propiedadesCreadas: string[] = [];
const arrendatariosCreados: string[] = [];
const HOY = "2026-06-15";
// Contrato 2026-01-01 a 2026-12-31, día esperado 5, 600.000/mes; con HOY se
// sincronizan los pagos esperados de enero a junio.
const MES = "2026-03";

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const filas = await prisma.contratoArriendo.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true, arrendatarioId: true },
    });
    const idsContrato = filas.map((c) => c.id);
    if (idsContrato.length) {
      await prisma.abonoArriendo.deleteMany({ where: { pagoEsperado: { contratoId: { in: idsContrato } } } });
      await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: idsContrato } } });
      await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: idsContrato } } });
      await prisma.contratoArriendo.deleteMany({ where: { id: { in: idsContrato } } });
    }
    arrendatariosCreados.push(...filas.map((c) => c.arrendatarioId));
    const cr = await prisma.creditoHipotecario.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    const idsCredito = cr.map((c) => c.id);
    if (idsCredito.length) {
      await prisma.creditoRegistroMensual.deleteMany({ where: { creditoId: { in: idsCredito } } });
    }
    await prisma.creditoHipotecario.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.movimientoFinanciero.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  if (arrendatariosCreados.length) {
    await prisma.arrendatario.deleteMany({ where: { id: { in: arrendatariosCreados } } });
  }
  await prisma.$disconnect();
});

let contador = 0;
async function nuevaPropiedad() {
  contador += 1;
  const p = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: `TEST-DASH-${contador}`,
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(p.id);
  return p.id;
}

async function conContrato(propiedadId: string) {
  const arr = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Arrendatario Ficticio" }));
  arrendatariosCreados.push(arr.id);
  const c = await contratos.crear(
    propiedadId,
    contratoCrearSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      diaEsperadoPago: 5,
      arrendatarioId: arr.id,
      montoMensualClp: "600000",
    }),
    HOY
  );
  await contratos.sincronizarPagos(propiedadId, c.id, HOY);
  return c.id;
}

async function pagoDe(propiedadId: string, contratoId: string, periodo: string) {
  const p = (await pagos.listarPagos(propiedadId, contratoId, HOY)).find((x) => x.periodo === periodo);
  assert.ok(p, `pago ${periodo}`);
  return p;
}

async function abonar(propiedadId: string, contratoId: string, periodo: string, monto: string, fecha: string) {
  const pago = await pagoDe(propiedadId, contratoId, periodo);
  return pagos.crearAbono(
    propiedadId,
    contratoId,
    pago.id,
    abonoInputSchema.parse({ montoClp: monto, fechaRecepcion: fecha }),
    HOY
  );
}

const gasto = (extra: Record<string, unknown> = {}) =>
  movimientoInputSchema.parse({ fecha: "2026-03-10", categoria: "REPARACION", montoClp: "100000", ...extra });

async function conCredito(propiedadId: string) {
  await creditos.crear(
    propiedadId,
    creditoInputSchema.parse({
      banco: "Banco Ficticio",
      cuotaContractualUf: "12.3456",
      tasaInteresAnual: "4.1250",
      numeroCuotasTotal: 240,
      diaVencimiento: 5,
    })
  );
}

const registro = (extra: Record<string, unknown>) => registroMensualCrearSchema.parse(extra);

test("totales: ingresos, dividendos y otros egresos; flujo neto negativo; sin duplicar el dividendo", { skip }, async () => {
  const id = await nuevaPropiedad();
  const cid = await conContrato(id);
  await conCredito(id);
  await abonar(id, cid, "2026-03-01", "500000", "2026-03-04");
  await registros.crear(id, registro({ periodo: MES, dividendoPagadoClp: "450000", fechaPagoDividendo: "2026-03-05" }));
  await movimientos.crear(id, gasto({ montoClp: "200000" }), HOY);

  const r = await service.resumenPropiedad(id, MES, HOY);
  assert.equal(r.ingresosClp, "500000");
  assert.equal(r.dividendosClp, "450000");
  assert.equal(r.otrosEgresosClp, "200000"); // el dividendo no es movimiento
  assert.equal(r.egresosTotalesClp, "650000");
  assert.equal(r.flujoNetoClp, "-150000");
});

test("mes sin operaciones y mes futuro: ceros sin error; sin saldo → null", { skip }, async () => {
  const id = await nuevaPropiedad();
  for (const mes of ["2026-02", "2031-01"]) {
    const r = await service.resumenPropiedad(id, mes, HOY);
    assert.deepEqual(
      [r.ingresosClp, r.dividendosClp, r.otrosEgresosClp, r.egresosTotalesClp, r.flujoNetoClp],
      ["0", "0", "0", "0", "0"]
    );
    assert.deepEqual(r.actividad, []);
    assert.deepEqual(r.pagos, []);
    assert.equal(r.saldoCredito, null);
  }
});

test("desfase: abono de marzo cobrado en abril cuenta en abril, y el pago sigue siendo de marzo", { skip }, async () => {
  const id = await nuevaPropiedad();
  const cid = await conContrato(id);
  await abonar(id, cid, "2026-03-01", "600000", "2026-04-05");

  const marzo = await service.resumenPropiedad(id, "2026-03", HOY);
  const abril = await service.resumenPropiedad(id, "2026-04", HOY);
  assert.equal(marzo.ingresosClp, "0");
  assert.equal(abril.ingresosClp, "600000");
  // El estado del período contractual de marzo cuenta el abono recibido en abril.
  assert.equal(marzo.pagos.length, 1);
  assert.equal(marzo.pagos[0].estado, "PAGADO");
  assert.equal(marzo.pagos[0].recibidoClp, "600000");
  assert.equal(marzo.pagos[0].saldoPendienteClp, "0");
  // Abril tiene su propio pago esperado, sin abonos.
  assert.equal(abril.pagos[0].periodo, "2026-04");
  assert.equal(abril.pagos[0].recibidoClp, "0");
});

test("desfase: dividendo del período marzo pagado en abril cuenta en abril", { skip }, async () => {
  const id = await nuevaPropiedad();
  await conCredito(id);
  await registros.crear(id, registro({ periodo: "2026-03", dividendoPagadoClp: "450000", fechaPagoDividendo: "2026-04-03" }));
  assert.equal((await service.resumenPropiedad(id, "2026-03", HOY)).dividendosClp, "0");
  assert.equal((await service.resumenPropiedad(id, "2026-04", HOY)).dividendosClp, "450000");
});

test("registro con solo saldo no aporta dividendos", { skip }, async () => {
  const id = await nuevaPropiedad();
  await conCredito(id);
  await registros.crear(id, registro({ periodo: MES, saldoPendienteUf: "900.5" }));
  const r = await service.resumenPropiedad(id, MES, HOY);
  assert.equal(r.dividendosClp, "0");
  assert.deepEqual(r.saldoCredito, { periodo: MES, saldoPendienteUf: "900.5" });
});

test("editar y eliminar movimiento y abono se reflejan en la siguiente consulta", { skip }, async () => {
  const id = await nuevaPropiedad();
  const cid = await conContrato(id);
  const m = await movimientos.crear(id, gasto({ montoClp: "100000" }), HOY);
  const a = await abonar(id, cid, "2026-03-01", "300000", "2026-03-04");
  assert.equal((await service.resumenPropiedad(id, MES, HOY)).flujoNetoClp, "200000");

  await movimientos.editar(id, m.id, gasto({ montoClp: "50000" }), HOY);
  assert.equal((await service.resumenPropiedad(id, MES, HOY)).flujoNetoClp, "250000");
  await movimientos.eliminar(id, m.id);
  assert.equal((await service.resumenPropiedad(id, MES, HOY)).flujoNetoClp, "300000");
  const pago = await pagoDe(id, cid, "2026-03-01");
  await pagos.eliminarAbono(id, cid, pago.id, a.id);
  const r = await service.resumenPropiedad(id, MES, HOY);
  assert.equal(r.ingresosClp, "0");
  assert.equal(r.flujoNetoClp, "0");
});

test("aislamiento por propiedad y total de cartera = suma de las filas", { skip }, async () => {
  const a = await nuevaPropiedad();
  const b = await nuevaPropiedad();
  await movimientos.crear(a, gasto({ montoClp: "70000" }), HOY);
  await movimientos.crear(a, gasto({ montoClp: "30000", categoria: "SEGURO" }), HOY);

  const cartera = await service.resumenMensual(MES, HOY);
  const fa = cartera.propiedades.find((f) => f.propiedadId === a);
  const fb = cartera.propiedades.find((f) => f.propiedadId === b);
  assert.equal(fa?.otrosEgresosClp, "100000");
  assert.equal(fb?.otrosEgresosClp, "0");
  assert.equal(fb?.flujoNetoClp, "0");

  const suma = (k: "ingresosClp" | "dividendosClp" | "otrosEgresosClp" | "egresosTotalesClp" | "flujoNetoClp") =>
    cartera.propiedades.reduce((acc, f) => acc + BigInt(f[k]), BigInt(0)).toString();
  assert.equal(cartera.totales.ingresosClp, suma("ingresosClp"));
  assert.equal(cartera.totales.dividendosClp, suma("dividendosClp"));
  assert.equal(cartera.totales.otrosEgresosClp, suma("otrosEgresosClp"));
  assert.equal(cartera.totales.egresosTotalesClp, suma("egresosTotalesClp"));
  assert.equal(cartera.totales.flujoNetoClp, suma("flujoNetoClp"));
  // El resumen individual coincide con su fila de cartera.
  const solo = await service.resumenPropiedad(a, MES, HOY);
  assert.equal(solo.flujoNetoClp, fa?.flujoNetoClp);
});

test("estados de pagos del mes contractual: pagado, vencido, pendiente y parcial", { skip }, async () => {
  const id = await nuevaPropiedad();
  const cid = await conContrato(id);
  await abonar(id, cid, "2026-03-01", "600000", "2026-03-04"); // pagado
  await abonar(id, cid, "2026-04-01", "200000", "2026-04-04"); // vencido con parcial

  assert.equal((await service.resumenPropiedad(id, "2026-03", HOY)).pagos[0].estado, "PAGADO");
  const abr = (await service.resumenPropiedad(id, "2026-04", HOY)).pagos[0];
  assert.equal(abr.estado, "VENCIDO");
  assert.equal(abr.recibidoClp, "200000");
  assert.equal(abr.saldoPendienteClp, "400000");
  assert.equal(abr.vencidoConAbonosParciales, true);
  // Misma consulta con «hoy» anterior al vencimiento (2026-03-05): sin abonos
  // el pago de marzo está pendiente; con un abono parcial, parcialmente pagado.
  const id2 = await nuevaPropiedad();
  const cid2 = await conContrato(id2);
  assert.equal((await service.resumenPropiedad(id2, "2026-03", "2026-03-01")).pagos[0].estado, "PENDIENTE");
  await abonar(id2, cid2, "2026-03-01", "100000", "2026-03-02");
  assert.equal(
    (await service.resumenPropiedad(id2, "2026-03", "2026-03-04")).pagos[0].estado,
    "PARCIALMENTE_PAGADO"
  );
});

test("saldo hipotecario por período: último registro hasta el mes, nunca posteriores", { skip }, async () => {
  const id = await nuevaPropiedad();
  await conCredito(id);
  await registros.crear(id, registro({ periodo: "2026-01", saldoPendienteUf: "1000" }));
  await registros.crear(id, registro({ periodo: "2026-03", saldoPendienteUf: "900.5" }));
  await registros.crear(id, registro({ periodo: "2026-05", saldoPendienteUf: "800" }));

  const saldo = async (mes: string) => (await service.resumenPropiedad(id, mes, HOY)).saldoCredito;
  assert.equal(await saldo("2025-12"), null);
  assert.deepEqual(await saldo("2026-02"), { periodo: "2026-01", saldoPendienteUf: "1000" });
  assert.deepEqual(await saldo("2026-03"), { periodo: "2026-03", saldoPendienteUf: "900.5" });
  assert.deepEqual(await saldo("2026-04"), { periodo: "2026-03", saldoPendienteUf: "900.5" });
  assert.deepEqual(await saldo("2030-01"), { periodo: "2026-05", saldoPendienteUf: "800" });
});

test("actividad reciente: tres orígenes, descendente y sin duplicados", { skip }, async () => {
  const id = await nuevaPropiedad();
  const cid = await conContrato(id);
  await conCredito(id);
  await abonar(id, cid, "2026-03-01", "300000", "2026-03-05");
  await registros.crear(id, registro({ periodo: MES, dividendoPagadoClp: "450000", fechaPagoDividendo: "2026-03-10" }));
  await movimientos.crear(id, gasto({ fecha: "2026-03-20" }), HOY);

  const { actividad } = await service.resumenPropiedad(id, MES, HOY);
  assert.deepEqual(
    actividad.map((a) => [a.origen, a.fecha]),
    [
      ["MOVIMIENTO", "2026-03-20"],
      ["DIVIDENDO", "2026-03-10"],
      ["ABONO", "2026-03-05"],
    ]
  );
  assert.ok(actividad.every((a) => a.href.startsWith(`/propiedades/${id}/`)));
});

test("propiedad inexistente o id no UUID → 404", { skip }, async () => {
  await assert.rejects(() => service.resumenPropiedad("no-es-uuid", MES, HOY), NotFoundError);
  await assert.rejects(
    () => service.resumenPropiedad("00000000-0000-4000-8000-000000000000", MES, HOY),
    NotFoundError
  );
});
