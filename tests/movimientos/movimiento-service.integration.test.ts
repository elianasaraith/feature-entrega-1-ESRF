import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createMovimientoService } from "../../server/services/movimiento-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { NotFoundError, UnprocessableError } from "../../server/errors";
import { creditoInputSchema } from "../../server/schemas/credito";
import { registroMensualCrearSchema } from "../../server/schemas/credito-registro";
import { movimientoInputSchema } from "../../server/schemas/movimiento";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { resolveTestDatabase } from "../setup/test-db";

// Integración de T07 contra PostgreSQL real. Solo corre con TEST_DATABASE_URL
// explícita y distinta de DATABASE_URL/DIRECT_URL (tests/setup/test-db.ts); si
// no, se omite. Cada prueba borra únicamente lo que creó, por id (movimientos →
// registros → crédito → propiedades). Datos ficticios.
const { url: testUrl, skip } = resolveTestDatabase();

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const creditos = createCreditoService(prisma);
const registros = createCreditoRegistroService(prisma);
const service = createMovimientoService(prisma);
const propiedadesCreadas: string[] = [];
const HOY = "2026-06-15";

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const creditosDe = await prisma.creditoHipotecario.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    const ids = creditosDe.map((c) => c.id);
    if (ids.length) {
      await prisma.creditoRegistroMensual.deleteMany({ where: { creditoId: { in: ids } } });
    }
    await prisma.creditoHipotecario.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.movimientoFinanciero.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.$disconnect();
});

async function nuevaPropiedad() {
  const dto = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-MOV-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(dto.id);
  return dto.id;
}

const entrada = (extra: Record<string, unknown> = {}) =>
  movimientoInputSchema.parse({
    fecha: "2026-03-10",
    categoria: "REPARACION",
    montoClp: "100000",
    ...extra,
  });

test("CRUD completo de un movimiento", { skip }, async () => {
  const id = await nuevaPropiedad();
  const creado = await service.crear(id, entrada({ descripcion: "Gasfitería" }), HOY);
  assert.equal(creado.propiedadId, id);
  assert.equal(creado.montoClp, "100000");
  assert.equal(creado.fecha, "2026-03-10");
  assert.equal(creado.descripcion, "Gasfitería");
  assert.deepEqual(await service.obtener(id, creado.id), creado);

  const editado = await service.editar(
    id,
    creado.id,
    entrada({ categoria: "SEGURO", montoClp: "30000", fecha: "2026-04-01" }),
    HOY
  );
  assert.equal(editado.categoria, "SEGURO");
  assert.equal(editado.montoClp, "30000");
  assert.equal(editado.fecha, "2026-04-01");
  assert.equal(editado.descripcion, null);

  await service.eliminar(id, creado.id);
  await assert.rejects(() => service.obtener(id, creado.id), NotFoundError);
  assert.equal((await service.listar(id)).movimientos.length, 0);
});

test("reglas de negocio: monto ≤ 0 y fecha futura → 422; hoy se acepta", { skip }, async () => {
  const id = await nuevaPropiedad();
  for (const montoClp of ["0", "-1"]) {
    await assert.rejects(() => service.crear(id, entrada({ montoClp }), HOY), UnprocessableError);
  }
  await assert.rejects(() => service.crear(id, entrada({ fecha: "2026-06-16" }), HOY), UnprocessableError);
  const hoy = await service.crear(id, entrada({ fecha: HOY }), HOY);
  assert.equal(hoy.fecha, HOY);

  await assert.rejects(() => service.editar(id, hoy.id, entrada({ montoClp: "0" }), HOY), UnprocessableError);
  await assert.rejects(
    () => service.editar(id, hoy.id, entrada({ fecha: "2026-06-16" }), HOY),
    UnprocessableError
  );
  assert.equal((await service.obtener(id, hoy.id)).montoClp, "100000");
  assert.equal((await service.listar(id)).movimientos.length, 1);
});

test("pertenencia: propiedad inexistente, id no UUID y movimiento de otra propiedad → 404", { skip }, async () => {
  const a = await nuevaPropiedad();
  const b = await nuevaPropiedad();
  const deA = await service.crear(a, entrada(), HOY);
  const inexistente = "00000000-0000-4000-8000-000000000000";

  await assert.rejects(() => service.crear(inexistente, entrada(), HOY), NotFoundError);
  await assert.rejects(() => service.listar("no-es-uuid"), NotFoundError);
  await assert.rejects(() => service.obtener(a, "no-es-uuid"), NotFoundError);
  await assert.rejects(() => service.obtener(a, inexistente), NotFoundError);
  await assert.rejects(() => service.obtener(b, deA.id), NotFoundError);
  await assert.rejects(() => service.editar(b, deA.id, entrada(), HOY), NotFoundError);
  await assert.rejects(() => service.eliminar(b, deA.id), NotFoundError);
  assert.equal((await service.obtener(a, deA.id)).montoClp, "100000");
});

test("listado: sin mes cubre todo el historial; con mes, solo ese mes (extremos incluidos)", { skip }, async () => {
  const id = await nuevaPropiedad();
  const otra = await nuevaPropiedad();
  await service.crear(id, entrada({ fecha: "2026-02-28", montoClp: "1" }), HOY);
  await service.crear(id, entrada({ fecha: "2026-03-01", montoClp: "10" }), HOY);
  await service.crear(id, entrada({ fecha: "2026-03-31", categoria: "SEGURO", montoClp: "20" }), HOY);
  await service.crear(id, entrada({ fecha: "2026-04-01", montoClp: "100" }), HOY);
  await service.crear(otra, entrada({ fecha: "2026-03-15", montoClp: "999" }), HOY);

  const todo = await service.listar(id);
  assert.equal(todo.mes, null);
  assert.deepEqual(todo.movimientos.map((m) => m.fecha), ["2026-04-01", "2026-03-31", "2026-03-01", "2026-02-28"]);
  assert.equal(todo.totalClp, "131");

  const marzo = await service.listar(id, { mes: "2026-03" });
  assert.equal(marzo.mes, "2026-03");
  assert.deepEqual(marzo.movimientos.map((m) => m.fecha), ["2026-03-31", "2026-03-01"]);
  assert.equal(marzo.totalClp, "30");
  assert.equal(marzo.porCategoria.REPARACION, "10");
  assert.equal(marzo.porCategoria.SEGURO, "20");
  assert.equal(marzo.porCategoria.OTRO, "0");

  assert.deepEqual(await service.resumenMensual(id, "2026-03"), {
    mes: "2026-03",
    totalClp: marzo.totalClp,
    porCategoria: marzo.porCategoria,
  });
  assert.equal((await service.resumenMensual(id, "2026-05")).totalClp, "0");
});

test("GASTO_COMUN en un mes sin contrato figura como egreso de la propiedad", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await service.crear(id, entrada({ categoria: "GASTO_COMUN", fecha: "2026-05-10", montoClp: "45000" }), HOY);
  const mayo = await service.listar(id, { mes: "2026-05" });
  assert.deepEqual(mayo.movimientos.map((x) => x.id), [m.id]);
  assert.equal(mayo.porCategoria.GASTO_COMUN, "45000");
});

test("no duplica dividendos: el dividendo de T03 no aparece en los movimientos", { skip }, async () => {
  const id = await nuevaPropiedad();
  await creditos.crear(
    id,
    creditoInputSchema.parse({
      banco: "Banco Ficticio",
      cuotaContractualUf: "12.3456",
      tasaInteresAnual: "4.1250",
      numeroCuotasTotal: 240,
      diaVencimiento: 5,
    })
  );
  await registros.crear(
    id,
    registroMensualCrearSchema.parse({
      periodo: "2026-03",
      dividendoPagadoClp: "850000",
      fechaPagoDividendo: "2026-03-05",
    })
  );
  await service.crear(id, entrada({ fecha: "2026-03-10", montoClp: "100000" }), HOY);

  const marzo = await service.listar(id, { mes: "2026-03" });
  assert.equal(marzo.movimientos.length, 1);
  assert.equal(marzo.totalClp, "100000");
  const dividendo = await registros.obtenerPorPeriodo(id, "2026-03");
  assert.equal(dividendo.dividendoPagadoClp, "850000");
});

test("el CHECK de la base rechaza monto ≤ 0 aunque se eluda el servicio", { skip }, async () => {
  const id = await nuevaPropiedad();
  await assert.rejects(() =>
    prisma.movimientoFinanciero.create({
      data: { propiedadId: id, fecha: new Date("2026-03-10T00:00:00.000Z"), categoria: "OTRO", montoClp: "0" },
    })
  );
});
