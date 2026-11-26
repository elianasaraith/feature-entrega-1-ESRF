import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createMovimientoService } from "../../server/services/movimiento-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { ZodError } from "zod";
import { NotFoundError, UnprocessableError } from "../../server/errors";
import { creditoInputSchema } from "../../server/schemas/credito";
import { registroMensualCrearSchema } from "../../server/schemas/credito-registro";
import { movimientoEdicionSchema, movimientoInputSchema } from "../../server/schemas/movimiento";
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

// --- Desglose en conceptos (ampliación de T07) -------------------------------
// Siempre contra TEST_DATABASE_URL. Los conceptos se limpian en cascada al borrar
// los movimientos en `after`.
const CONCEPTOS = [
  { nombre: "Materiales", montoClp: "60000" },
  { nombre: "Mano de obra", montoClp: "70000" },
  { nombre: "Transporte", montoClp: "20000" },
];

const edicion = (extra: Record<string, unknown> = {}) =>
  movimientoEdicionSchema.parse({ fecha: "2026-03-10", categoria: "REPARACION", ...extra });

// Gasto desglosado de 150.000 (sin montoClp: lo calcula el servidor).
const desglosado = (propiedadId: string, extra: Record<string, unknown> = {}) =>
  service.crear(propiedadId, entrada({ montoClp: undefined, conceptos: CONCEPTOS, ...extra }), HOY);

const nombres = (m: { conceptos: { nombre: string }[] }) => m.conceptos.map((c) => c.nombre);
const filasDeConceptos = (movimientoId: string) =>
  prisma.movimientoConcepto.count({ where: { movimientoFinancieroId: movimientoId } });
const filasDeMovimientos = (propiedadId: string) => prisma.movimientoFinanciero.count({ where: { propiedadId } });

test("alta desglosada: el servidor calcula el total y conserva el orden", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id, { descripcion: "Baño" });
  assert.equal(m.montoClp, "150000");
  assert.equal(m.descripcion, "Baño");
  assert.deepEqual(m.conceptos.map((c) => [c.nombre, c.montoClp, c.orden]), [
    ["Materiales", "60000", 0],
    ["Mano de obra", "70000", 1],
    ["Transporte", "20000", 2],
  ]);
  assert.deepEqual(await service.obtener(id, m.id), m);
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("alta: montoClp coincidente se acepta; discordante → 422 sin crear nada", { skip }, async () => {
  const id = await nuevaPropiedad();
  const ok = await desglosado(id, { montoClp: "150000" });
  assert.equal(ok.montoClp, "150000");
  await assert.rejects(() => desglosado(id, { montoClp: "140000" }), UnprocessableError);
  assert.equal(await filasDeMovimientos(id), 1); // solo el válido
});

test("alta: concepto ≤ 0, total sobre 14 dígitos o fecha futura → 422 sin crear nada", { skip }, async () => {
  const id = await nuevaPropiedad();
  const con = (conceptos: unknown, extra: Record<string, unknown> = {}) =>
    service.crear(id, entrada({ montoClp: undefined, conceptos, ...extra }), HOY);
  await assert.rejects(() => con([{ nombre: "A", montoClp: "100" }, { nombre: "B", montoClp: "0" }]), UnprocessableError);
  await assert.rejects(() => con([{ nombre: "A", montoClp: "-1" }]), UnprocessableError);
  await assert.rejects(
    () => con([{ nombre: "A", montoClp: "99999999999999" }, { nombre: "B", montoClp: "1" }]),
    UnprocessableError
  );
  await assert.rejects(() => con(CONCEPTOS, { fecha: "2026-06-16" }), UnprocessableError);
  assert.equal(await filasDeMovimientos(id), 0);
});

test("alta: `conceptos: []` con monto crea un gasto simple; sin conceptos, también", { skip }, async () => {
  const id = await nuevaPropiedad();
  const vacio = await service.crear(id, entrada({ conceptos: [] }), HOY);
  const sin = await service.crear(id, entrada(), HOY);
  for (const m of [vacio, sin]) {
    assert.deepEqual(m.conceptos, []);
    assert.equal(m.montoClp, "100000");
    assert.equal(await filasDeConceptos(m.id), 0);
  }
});

test("compatibilidad: un gasto simple conserva su comportamiento y su DTO (más `conceptos: []`)", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await service.crear(id, entrada({ descripcion: "Gasfitería" }), HOY);
  assert.deepEqual(Object.keys(m).sort(), [
    "categoria", "conceptos", "createdAt", "descripcion", "fecha", "id", "montoClp", "propiedadId", "updatedAt",
  ]);
  const editado = await service.editar(id, m.id, edicion({ categoria: "SEGURO", montoClp: "30000" }), HOY);
  assert.equal(editado.categoria, "SEGURO");
  assert.equal(editado.montoClp, "30000");
  assert.deepEqual(editado.conceptos, []);
});

test("protección: `conceptos` ausente conserva el desglose y el total, con o sin montoClp", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);

  const sinMonto = await service.editar(id, m.id, edicion({ fecha: "2026-04-01", categoria: "SEGURO", descripcion: "Nueva" }), HOY);
  assert.equal(sinMonto.fecha, "2026-04-01");
  assert.equal(sinMonto.categoria, "SEGURO");
  assert.equal(sinMonto.descripcion, "Nueva");
  assert.equal(sinMonto.montoClp, "150000");
  assert.deepEqual(sinMonto.conceptos, m.conceptos); // mismos ids, nombres, montos y orden

  const conTotal = await service.editar(id, m.id, edicion({ descripcion: "Solo la descripción", montoClp: "150000" }), HOY);
  assert.equal(conTotal.descripcion, "Solo la descripción");
  assert.deepEqual(conTotal.conceptos, m.conceptos);
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("protección: `conceptos` ausente con monto distinto → 422 y el registro no cambia", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const antes = await service.obtener(id, m.id);
  await assert.rejects(
    () => service.editar(id, m.id, edicion({ fecha: "2026-05-01", categoria: "OTRO", descripcion: "x", montoClp: "100000" }), HOY),
    UnprocessableError
  );
  assert.deepEqual(await service.obtener(id, m.id), antes); // incluye updatedAt: ni siquiera se escribió
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("`conceptos` ausente sobre un simple: edición normal; sin monto → 400 (ZodError con montoClp)", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await service.crear(id, entrada(), HOY);
  assert.equal((await service.editar(id, m.id, edicion({ montoClp: "5" }), HOY)).montoClp, "5");
  await assert.rejects(
    () => service.editar(id, m.id, edicion(), HOY),
    (e: unknown) => e instanceof ZodError && e.issues[0].path.join(".") === "montoClp"
  );
  assert.equal((await service.obtener(id, m.id)).montoClp, "5");
});

test("`conceptos: []` convierte a simple y elimina el desglose, conservando id y createdAt", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const simple = await service.editar(id, m.id, edicion({ conceptos: [], montoClp: "150000" }), HOY);
  assert.equal(simple.id, m.id);
  assert.equal(simple.createdAt, m.createdAt);
  assert.equal(simple.montoClp, "150000");
  assert.deepEqual(simple.conceptos, []);
  assert.equal(await filasDeConceptos(m.id), 0);
});

test("`conceptos: []` sin monto (400) o con monto ≤ 0 (422) no toca el desglose", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const antes = await service.obtener(id, m.id);
  // El esquema ya lo rechaza (400); aquí se prueba además la defensa del servicio.
  await assert.rejects(
    () => service.editar(id, m.id, { fecha: "2026-03-10", categoria: "REPARACION", descripcion: null, conceptos: [] }, HOY),
    ZodError
  );
  for (const montoClp of ["0", "-1"]) {
    await assert.rejects(() => service.editar(id, m.id, edicion({ conceptos: [], montoClp }), HOY), UnprocessableError);
  }
  assert.deepEqual(await service.obtener(id, m.id), antes);
});

test("reemplazo: los conceptos anteriores desaparecen, los nuevos quedan en orden y el total se recalcula", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const nuevo = await service.editar(
    id,
    m.id,
    edicion({ conceptos: [{ nombre: "Pintura", montoClp: "40000" }, { nombre: "Insumos", montoClp: "10000" }] }),
    HOY
  );
  assert.equal(nuevo.montoClp, "50000");
  assert.deepEqual(nombres(nuevo), ["Pintura", "Insumos"]);
  assert.deepEqual(nuevo.conceptos.map((c) => c.orden), [0, 1]);
  assert.equal(await filasDeConceptos(m.id), 2);
  const idsAnteriores = new Set(m.conceptos.map((c) => c.id));
  assert.ok(nuevo.conceptos.every((c) => !idsAnteriores.has(c.id)));
});

test("reemplazo con suma discordante, concepto ≤ 0 o fecha futura → 422 con conceptos y total originales", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const antes = await service.obtener(id, m.id);
  const intento = (extra: Record<string, unknown>) =>
    service.editar(id, m.id, edicion({ conceptos: [{ nombre: "Otro", montoClp: "1000" }], ...extra }), HOY);
  await assert.rejects(() => intento({ montoClp: "999" }), UnprocessableError);
  await assert.rejects(
    () => service.editar(id, m.id, edicion({ conceptos: [{ nombre: "Cero", montoClp: "0" }] }), HOY),
    UnprocessableError
  );
  await assert.rejects(() => intento({ fecha: "2026-06-16" }), UnprocessableError);
  assert.deepEqual(await service.obtener(id, m.id), antes);
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("conversión simple → desglosado: el total pasa a ser la suma, con el mismo id", { skip }, async () => {
  const id = await nuevaPropiedad();
  const simple = await service.crear(id, entrada({ montoClp: "100000" }), HOY);
  const des = await service.editar(id, simple.id, edicion({ conceptos: CONCEPTOS }), HOY);
  assert.equal(des.id, simple.id);
  assert.equal(des.montoClp, "150000");
  assert.deepEqual(nombres(des), ["Materiales", "Mano de obra", "Transporte"]);
  // Y con montoClp coincidente.
  const otra = await service.crear(id, entrada({ montoClp: "1" }), HOY);
  assert.equal((await service.editar(id, otra.id, edicion({ conceptos: CONCEPTOS, montoClp: "150000" }), HOY)).montoClp, "150000");
});

test("atomicidad: si la escritura falla dentro de la transacción, el desglose original queda intacto", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const antes = await service.obtener(id, m.id);
  // Un NUL no es válido en TEXT de PostgreSQL: pasa Zod y la validación de
  // negocio, y falla al escribir, después de borrar los conceptos anteriores.
  await assert.rejects(() =>
    service.editar(id, m.id, edicion({ conceptos: [{ nombre: "a\u0000b", montoClp: "10" }] }), HOY)
  );
  assert.deepEqual(await service.obtener(id, m.id), antes);
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("atomicidad del alta: si falla un concepto no queda un movimiento sin desglose", { skip }, async () => {
  const id = await nuevaPropiedad();
  await assert.rejects(() =>
    service.crear(id, entrada({ montoClp: undefined, conceptos: [CONCEPTOS[0], { nombre: "a\u0000b", montoClp: "10" }] }), HOY)
  );
  assert.equal(await filasDeMovimientos(id), 0);
});

test("eliminar un movimiento desglosado elimina sus conceptos (CASCADE), también si se borra directo", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  const otro = await desglosado(id);
  await service.eliminar(id, m.id);
  assert.equal(await filasDeConceptos(m.id), 0);
  assert.equal(await filasDeConceptos(otro.id), 3); // no toca a los de otro movimiento
  await prisma.movimientoFinanciero.delete({ where: { id: otro.id } });
  assert.equal(await filasDeConceptos(otro.id), 0);
});

test("el CHECK de la base rechaza un concepto con monto ≤ 0 aunque se eluda el servicio", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  for (const montoClp of ["0", "-1"]) {
    await assert.rejects(() =>
      prisma.movimientoConcepto.create({ data: { movimientoFinancieroId: m.id, nombre: "x", montoClp, orden: 9 } })
    );
  }
  assert.equal(await filasDeConceptos(m.id), 3);
});

test("el listado trae un movimiento (no cuatro) y sus totales no suman conceptos", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await desglosado(id, { fecha: "2026-03-10" });
  const lista = await service.listar(id, { mes: "2026-03" });
  assert.equal(lista.movimientos.length, 1);
  assert.equal(lista.totalClp, "150000"); // no 300000
  assert.equal(lista.porCategoria.REPARACION, "150000");
  assert.deepEqual(lista.movimientos[0].conceptos, m.conceptos);
  assert.equal((await service.resumenMensual(id, "2026-03")).totalClp, "150000");
});

test("simples y desglosados en el mismo mes: cada uno cuenta una vez", { skip }, async () => {
  const id = await nuevaPropiedad();
  await service.crear(id, entrada({ fecha: "2026-03-05", montoClp: "100000" }), HOY);
  await desglosado(id, { fecha: "2026-03-10" });
  const lista = await service.listar(id, { mes: "2026-03" });
  assert.equal(lista.movimientos.length, 2);
  assert.equal(lista.totalClp, "250000");
  assert.deepEqual(lista.movimientos.map((m) => m.conceptos.length).sort(), [0, 3]);
});

test("aislamiento: no se pueden editar ni borrar desglosados de otra propiedad, y no se mezclan", { skip }, async () => {
  const a = await nuevaPropiedad();
  const b = await nuevaPropiedad();
  const deA = await desglosado(a);
  const antes = await service.obtener(a, deA.id);

  await assert.rejects(() => service.editar(b, deA.id, edicion({ conceptos: [{ nombre: "x", montoClp: "1" }] }), HOY), NotFoundError);
  await assert.rejects(() => service.editar(b, deA.id, edicion({ montoClp: "150000" }), HOY), NotFoundError);
  await assert.rejects(() => service.eliminar(b, deA.id), NotFoundError);
  await assert.rejects(() => service.obtener(b, deA.id), NotFoundError);
  assert.deepEqual(await service.obtener(a, deA.id), antes);
  assert.equal((await service.listar(b)).movimientos.length, 0);
  assert.equal(await filasDeConceptos(deA.id), 3);
});

test("DIVIDENDO sigue rechazado y no hay `tipo`: el desglose no abre otra vía", { skip }, async () => {
  assert.throws(() => movimientoInputSchema.parse({ fecha: "2026-03-10", categoria: "DIVIDENDO", conceptos: CONCEPTOS }));
  const id = await nuevaPropiedad();
  const m = await desglosado(id);
  assert.equal("tipo" in m, false);
});
