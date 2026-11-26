import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { ConflictError, NotFoundError, UnprocessableError } from "../../server/errors";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import {
  contratoActualizarSchema,
  contratoCrearSchema,
  montoCrearSchema,
} from "../../server/schemas/contrato";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { resolveTestDatabase } from "../setup/test-db";

// Integración de T05 (primer monto, reajustes, pagos esperados) contra
// PostgreSQL real. Solo corre con TEST_DATABASE_URL explícita y distinta de
// DATABASE_URL/DIRECT_URL (tests/setup/test-db.ts); si no, se omite. Cada prueba
// borra únicamente lo que creó, por id (pagos → montos → contratos →
// arrendatarios → propiedades). Datos ficticios.
const { url: testUrl, skip } = resolveTestDatabase();

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const arrendatarios = createArrendatarioService(prisma);
const service = createContratoService(prisma);
const propiedadesCreadas: string[] = [];
const arrendatariosCreados: string[] = [];
const REF = "2026-06-15";

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const contratos = await prisma.contratoArriendo.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true, arrendatarioId: true },
    });
    const ids = contratos.map((c) => c.id);
    if (ids.length) {
      await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: ids } } });
      await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: ids } } });
      await prisma.contratoArriendo.deleteMany({ where: { id: { in: ids } } });
    }
    arrendatariosCreados.push(...contratos.map((c) => c.arrendatarioId));
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  if (arrendatariosCreados.length) {
    await prisma.arrendatario.deleteMany({ where: { id: { in: arrendatariosCreados } } });
  }
  await prisma.$disconnect();
});

async function nuevaPropiedad() {
  const dto = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-MONTO-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(dto.id);
  return dto.id;
}

async function nuevoArrendatario() {
  const dto = await arrendatarios.crear(
    arrendatarioInputSchema.parse({ nombre: "Arrendatario Ficticio" })
  );
  arrendatariosCreados.push(dto.id);
  return dto.id;
}

// Contrato 2026-01-01 a 2026-12-31, día 5, garantía 500000 y sin monto.
async function nuevoContrato(extra: Record<string, unknown> = {}) {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const dto = await service.crear(
    propiedad,
    contratoCrearSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      diaEsperadoPago: 5,
      garantiaClp: "500000",
      arrendatarioId: arr,
      ...extra,
    }),
    REF
  );
  return { propiedad, arr, contrato: dto.id };
}

const monto = (periodo: string, clp: string | number, motivo?: string) =>
  montoCrearSchema.parse({ montoMensualClp: clp, vigenteDesdePeriodo: periodo, motivo });

const pagos = async (contratoId: string) =>
  (await prisma.pagoEsperado.findMany({ where: { contratoId }, orderBy: { periodo: "asc" } })).map(
    (p) => ({
      periodo: p.periodo.toISOString().slice(0, 10),
      monto: p.montoEsperadoClp.toString(),
      fecha: p.fechaEsperada.toISOString().slice(0, 10),
      updatedAt: p.updatedAt.getTime(),
    })
  );

const resumen = (filas: Awaited<ReturnType<typeof pagos>>) =>
  filas.map((p) => [p.periodo.slice(0, 7), p.monto]);

// ---------- Primer monto y reajustes (AC1) ----------

test("primer monto tardío: rige desde el mes de inicio y el contrato conserva su identidad", { skip }, async () => {
  const { propiedad, contrato, arr } = await nuevoContrato();
  assert.deepEqual((await service.listarMontos(propiedad, contrato, REF)).montos, []);
  const fila = await service.registrarMonto(propiedad, contrato, monto("2026-01", "500000"));
  assert.equal(fila.vigenteDesdePeriodo, "2026-01-01");
  assert.equal(fila.motivo, "monto inicial");
  const dto = await service.obtener(propiedad, contrato, REF);
  assert.equal(dto.montoInicialClp, "500000");
  assert.equal(dto.arrendatario.id, arr);
  assert.equal(dto.garantiaClp, "500000");
});

test("primer monto con período distinto al mes de inicio → 422 y no persiste", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato();
  await assert.rejects(
    service.registrarMonto(propiedad, contrato, monto("2026-03", "500000")),
    UnprocessableError
  );
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: contrato } }), 0);
});

test("reajuste: agrega fila, no altera las anteriores y el monto vigente cambia desde su mes", { skip }, async () => {
  const { propiedad, contrato, arr } = await nuevoContrato({ montoMensualClp: "500000" });
  const antes = await prisma.contratoMonto.findMany({ where: { contratoId: contrato } });
  const nueva = await service.registrarMonto(propiedad, contrato, monto("2026-09", "530000"));
  assert.equal(nueva.motivo, "reajuste");

  const despues = await prisma.contratoMonto.findMany({ where: { contratoId: contrato } });
  assert.equal(despues.length, 2);
  const original = despues.find((f) => f.id === antes[0].id)!;
  assert.equal(original.montoMensualClp.toString(), "500000");
  assert.equal(original.updatedAt.getTime(), antes[0].updatedAt.getTime());

  const agosto = await service.listarMontos(propiedad, contrato, "2026-08-31");
  const septiembre = await service.listarMontos(propiedad, contrato, "2026-09-01");
  assert.equal(agosto.montoVigenteClp, "500000");
  assert.equal(septiembre.montoVigenteClp, "530000");
  assert.deepEqual(
    septiembre.montos.map((m) => m.vigenteDesdePeriodo),
    ["2026-01-01", "2026-09-01"]
  );
  const dto = await service.obtener(propiedad, contrato, REF);
  assert.equal(dto.arrendatario.id, arr);
  assert.equal(dto.garantiaClp, "500000");
});

test("reajuste: período repetido → 409; fuera de la vigencia → 422", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  await assert.rejects(
    service.registrarMonto(propiedad, contrato, monto("2026-01", "510000")),
    ConflictError
  );
  await assert.rejects(
    service.registrarMonto(propiedad, contrato, monto("2025-12", "510000")),
    UnprocessableError
  );
  await assert.rejects(
    service.registrarMonto(propiedad, contrato, monto("2027-01", "510000")),
    UnprocessableError
  );
  // El mes de término, aunque su fecha no sea día 1, sí es válido.
  await service.registrarMonto(propiedad, contrato, monto("2026-12", "510000"));
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: contrato } }), 2);
});

test("montos de un contrato de otra propiedad o inexistente → 404", { skip }, async () => {
  const { contrato } = await nuevoContrato();
  const otra = await nuevaPropiedad();
  await assert.rejects(service.registrarMonto(otra, contrato, monto("2026-01", "1")), NotFoundError);
  await assert.rejects(service.listarMontos(otra, contrato, REF), NotFoundError);
  await assert.rejects(service.sincronizarPagos(otra, contrato, REF), NotFoundError);
  await assert.rejects(
    service.registrarMonto(otra, "no-es-uuid", monto("2026-01", "1")),
    NotFoundError
  );
});

// ---------- Pagos esperados: sincronización (AC4) ----------

test("sincronizar: crea desde el mes de inicio hasta el mes en curso con su fecha esperada", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  assert.deepEqual(await service.sincronizarPagos(propiedad, contrato, REF), {
    creados: 6,
    existentes: 0,
  });
  const filas = await pagos(contrato);
  assert.deepEqual(resumen(filas), [
    ["2026-01", "500000"],
    ["2026-02", "500000"],
    ["2026-03", "500000"],
    ["2026-04", "500000"],
    ["2026-05", "500000"],
    ["2026-06", "500000"],
  ]);
  assert.equal(filas[0].periodo, "2026-01-01");
  assert.equal(filas[0].fecha, "2026-01-05");
});

test("sincronizar es idempotente y continúa en meses posteriores sin tocar lo existente", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  await service.sincronizarPagos(propiedad, contrato, REF);
  const antes = await pagos(contrato);
  assert.deepEqual(await service.sincronizarPagos(propiedad, contrato, REF), {
    creados: 0,
    existentes: 6,
  });
  assert.deepEqual(await pagos(contrato), antes);

  assert.deepEqual(await service.sincronizarPagos(propiedad, contrato, "2026-08-01"), {
    creados: 2,
    existentes: 6,
  });
  assert.deepEqual((await pagos(contrato)).slice(0, 6), antes);
  assert.equal((await pagos(contrato)).length, 8);
});

test("sincronizar: dos ejecuciones simultáneas no duplican pagos", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  const resultados = await Promise.all([
    service.sincronizarPagos(propiedad, contrato, REF),
    service.sincronizarPagos(propiedad, contrato, REF),
  ]);
  assert.equal(resultados.reduce((total, r) => total + r.creados, 0), 6);
  assert.equal((await pagos(contrato)).length, 6);
});

test("sincronizar: sin monto no crea nada; el alta tampoco genera pagos", { skip }, async () => {
  const sinMonto = await nuevoContrato();
  assert.deepEqual(await service.sincronizarPagos(sinMonto.propiedad, sinMonto.contrato, REF), {
    creados: 0,
    existentes: 0,
  });
  const conMonto = await nuevoContrato({ montoMensualClp: "500000" });
  assert.equal((await pagos(conMonto.contrato)).length, 0);
  assert.equal((await service.listarMontos(conMonto.propiedad, conMonto.contrato, REF)).montos.length, 1);
  assert.equal((await pagos(conMonto.contrato)).length, 0, "listar no escribe");
});

test("sincronizar: nunca pasa del mes de término ni antes del inicio (AC4)", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({
    fechaInicio: "2026-03-10",
    fechaTermino: "2026-05-20",
    montoMensualClp: "500000",
  });
  assert.deepEqual(await service.sincronizarPagos(propiedad, contrato, "2027-01-01"), {
    creados: 3,
    existentes: 0,
  });
  assert.deepEqual(
    (await pagos(contrato)).map((p) => p.periodo),
    ["2026-03-01", "2026-04-01", "2026-05-01"]
  );
  const futuro = await nuevoContrato({
    fechaInicio: "2026-09-01",
    fechaTermino: "2026-12-31",
    montoMensualClp: "500000",
  });
  assert.equal((await service.sincronizarPagos(futuro.propiedad, futuro.contrato, REF)).creados, 0);
});

test("fecha esperada: día 31 cae en el último día de febrero", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({
    fechaInicio: "2026-01-01",
    fechaTermino: "2026-03-31",
    diaEsperadoPago: 31,
    montoMensualClp: "500000",
  });
  await service.sincronizarPagos(propiedad, contrato, "2026-12-01");
  assert.deepEqual(
    (await pagos(contrato)).map((p) => p.fecha),
    ["2026-01-31", "2026-02-28", "2026-03-31"]
  );
});

// ---------- Reajustes sobre pagos esperados (AC2, AC3) ----------

test("reajuste retroactivo: actualiza solo desde su período y no pisa un reajuste posterior", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  await service.sincronizarPagos(propiedad, contrato, REF);

  await service.registrarMonto(propiedad, contrato, monto("2026-04", "530000"));
  assert.deepEqual(resumen(await pagos(contrato)), [
    ["2026-01", "500000"],
    ["2026-02", "500000"],
    ["2026-03", "500000"],
    ["2026-04", "530000"],
    ["2026-05", "530000"],
    ["2026-06", "530000"],
  ]);

  await service.registrarMonto(propiedad, contrato, monto("2026-06", "560000"));
  // Retroactivo desde febrero: abril y mayo conservan 530000, junio 560000.
  await service.registrarMonto(propiedad, contrato, monto("2026-02", "520000"));
  assert.deepEqual(resumen(await pagos(contrato)), [
    ["2026-01", "500000"],
    ["2026-02", "520000"],
    ["2026-03", "520000"],
    ["2026-04", "530000"],
    ["2026-05", "530000"],
    ["2026-06", "560000"],
  ]);
  assert.equal((await pagos(contrato)).length, 6, "el reajuste no crea pagos");
});

test("updated_at cambia solo en los pagos cuyo monto esperado cambió", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  await service.sincronizarPagos(propiedad, contrato, REF);
  const antes = await pagos(contrato);

  await service.registrarMonto(propiedad, contrato, monto("2026-04", "530000"));
  const despues = await pagos(contrato);
  for (let i = 0; i < 3; i++) assert.equal(despues[i].updatedAt, antes[i].updatedAt, `mes ${i + 1}`);
  for (let i = 3; i < 6; i++) assert.ok(despues[i].updatedAt > antes[i].updatedAt, `mes ${i + 1}`);

  // Una fila que no cambia ningún monto (500000 → 500000 en marzo, pero abril
  // sigue regido por su propia fila) deja intactos todos los pagos.
  await service.registrarMonto(propiedad, contrato, monto("2026-03", "500000"));
  assert.deepEqual(await pagos(contrato), despues);
});

test("meses aún no generados nacen con el monto que les corresponde (AC2)", { skip }, async () => {
  const { propiedad, contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  await service.registrarMonto(propiedad, contrato, monto("2026-04", "530000"));
  assert.equal((await pagos(contrato)).length, 0);
  await service.sincronizarPagos(propiedad, contrato, REF);
  assert.deepEqual(
    (await pagos(contrato)).map((p) => p.monto),
    ["500000", "500000", "500000", "530000", "530000", "530000"]
  );
});

// ---------- Edición de contrato (409 por término) ----------

test("PUT: acortar el término por debajo de un monto o pago registrado → 409; válido → 200", { skip }, async () => {
  const { propiedad, contrato, arr } = await nuevoContrato({ montoMensualClp: "500000" });
  const edicion = (fechaTermino: string) =>
    contratoActualizarSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino,
      diaEsperadoPago: 5,
      arrendatarioId: arr,
    });

  await service.registrarMonto(propiedad, contrato, monto("2026-09", "530000"));
  await assert.rejects(service.actualizar(propiedad, contrato, edicion("2026-08-31"), REF), ConflictError);
  assert.equal((await service.actualizar(propiedad, contrato, edicion("2026-09-30"), REF)).fechaTermino, "2026-09-30");

  await service.sincronizarPagos(propiedad, contrato, "2026-09-01");
  await assert.rejects(service.actualizar(propiedad, contrato, edicion("2026-08-31"), REF), ConflictError);
  assert.equal(
    (await prisma.contratoArriendo.findUniqueOrThrow({ where: { id: contrato } })).fechaTermino
      .toISOString()
      .slice(0, 10),
    "2026-09-30"
  );
  // El PUT sigue sin escribir en montos ni pagos.
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: contrato } }), 2);
  assert.equal((await pagos(contrato)).length, 9);
});

// ---------- Restricciones de la base ----------

test("CHECK de pago_esperado: monto > 0 y período día 1; UNIQUE por contrato y período", { skip }, async () => {
  const { contrato } = await nuevoContrato({ montoMensualClp: "500000" });
  const data = {
    contratoId: contrato,
    periodo: new Date("2026-03-01T00:00:00Z"),
    montoEsperadoClp: "500000",
    fechaEsperada: new Date("2026-03-05T00:00:00Z"),
  };
  await assert.rejects(prisma.pagoEsperado.create({ data: { ...data, montoEsperadoClp: "0" } }));
  await assert.rejects(
    prisma.pagoEsperado.create({ data: { ...data, periodo: new Date("2026-03-02T00:00:00Z") } })
  );
  await prisma.pagoEsperado.create({ data });
  await assert.rejects(prisma.pagoEsperado.create({ data }));
});
