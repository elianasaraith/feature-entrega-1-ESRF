import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { ConflictError, NotFoundError } from "../../server/errors";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import {
  contratoActualizarSchema,
  contratoCrearSchema,
  type ContratoCrearInput,
} from "../../server/schemas/contrato";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { resolveTestDatabase } from "../setup/test-db";

// Integración contra PostgreSQL real. Solo corre con TEST_DATABASE_URL explícita
// y distinta de DATABASE_URL/DIRECT_URL (ver tests/setup/test-db.ts); si no,
// se omite sin escribir nada. Cada prueba borra únicamente lo que creó, por id
// (montos → contratos → arrendatarios → propiedades, por las FK Restrict).
// Datos ficticios.
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
      numeroDepartamento: "TEST-CTR-1",
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

const rutUnico = () => `TEST-${randomUUID()}`;

function contrato(arrendatarioId: string, extra: Record<string, unknown> = {}) {
  return contratoCrearSchema.parse({
    fechaInicio: "2026-01-01",
    fechaTermino: "2026-12-31",
    diaEsperadoPago: 5,
    arrendatarioId,
    ...extra,
  });
}

function edicion(arrendatarioId: string, extra: Record<string, unknown> = {}) {
  return contratoActualizarSchema.parse({
    fechaInicio: "2026-01-01",
    fechaTermino: "2026-12-31",
    diaEsperadoPago: 5,
    arrendatarioId,
    ...extra,
  });
}

const alta = (propiedadId: string, input: ContratoCrearInput) =>
  service.crear(propiedadId, input, REF);

// ---------- Alta, vigencia y contratos sucesivos ----------

test("alta con arrendatario existente: round-trip, vigencia derivada y sin monto", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const dto = await alta(propiedad, contrato(arr, { garantiaClp: "500000", observaciones: "Nota" }));
  assert.equal(dto.propiedadId, propiedad);
  assert.equal(dto.arrendatario.id, arr);
  assert.equal(dto.fechaInicio, "2026-01-01");
  assert.equal(dto.fechaTermino, "2026-12-31");
  assert.equal(dto.garantiaClp, "500000");
  assert.equal(dto.diaEsperadoPago, 5);
  assert.equal(dto.observaciones, "Nota");
  assert.equal(dto.vigencia, "VIGENTE");
  assert.equal(dto.montoInicialClp, null);
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: dto.id } }), 0);
  assert.deepEqual(await service.obtener(propiedad, dto.id, REF), dto);
});

test("contratos sucesivos con otro arrendatario: ambos constan, más reciente primero", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const a1 = await nuevoArrendatario();
  const a2 = await nuevoArrendatario();
  await alta(propiedad, contrato(a1, { fechaInicio: "2025-01-01", fechaTermino: "2025-12-31" }));
  await alta(propiedad, contrato(a2, { fechaInicio: "2026-01-01", fechaTermino: "2026-12-31" }));
  const lista = await service.listar(propiedad, REF);
  assert.deepEqual(
    lista.map((c) => [c.arrendatario.id, c.vigencia]),
    [
      [a2, "VIGENTE"],
      [a1, "FINALIZADO"],
    ]
  );
});

test("propiedad sin contratos → lista vacía; propiedad inexistente o no UUID → NotFoundError", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  assert.deepEqual(await service.listar(propiedad, REF), []);
  await assert.rejects(service.listar(randomUUID(), REF), NotFoundError);
  await assert.rejects(service.listar("no-es-uuid", REF), NotFoundError);
  const arr = await nuevoArrendatario();
  await assert.rejects(alta(randomUUID(), contrato(arr)), NotFoundError);
});

// ---------- Solape inclusivo ----------

test("solape parcial y borde compartido → ConflictError; sucesivo sin solape → creado", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  await alta(propiedad, contrato(arr, { fechaInicio: "2026-01-01", fechaTermino: "2026-12-31" }));
  await assert.rejects(
    alta(propiedad, contrato(arr, { fechaInicio: "2026-06-01", fechaTermino: "2027-05-31" })),
    ConflictError
  );
  await assert.rejects(
    alta(propiedad, contrato(arr, { fechaInicio: "2026-12-31", fechaTermino: "2027-12-30" })),
    ConflictError
  );
  await assert.rejects(
    alta(propiedad, contrato(arr, { fechaInicio: "2025-06-01", fechaTermino: "2026-01-01" })),
    ConflictError
  );
  const siguiente = await alta(
    propiedad,
    contrato(arr, { fechaInicio: "2027-01-01", fechaTermino: "2027-12-31" })
  );
  assert.equal(siguiente.vigencia, "FUTURO");
  assert.equal((await service.listar(propiedad, REF)).length, 2);
});

test("mismo rango en otra propiedad → creado", { skip }, async () => {
  const p1 = await nuevaPropiedad();
  const p2 = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  await alta(p1, contrato(arr));
  await alta(p2, contrato(arr));
});

test("PUT: solape con el siguiente → ConflictError; mismo rango propio → ok; terminación anticipada", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const c1 = await alta(propiedad, contrato(arr, { fechaInicio: "2026-01-01", fechaTermino: "2026-06-30" }));
  await alta(propiedad, contrato(arr, { fechaInicio: "2026-07-01", fechaTermino: "2026-12-31" }));

  await assert.rejects(
    service.actualizar(propiedad, c1.id, edicion(arr, { fechaTermino: "2026-07-01" }), REF),
    ConflictError
  );
  assert.equal((await service.obtener(propiedad, c1.id, REF)).fechaTermino, "2026-06-30");

  const igual = await service.actualizar(
    propiedad,
    c1.id,
    edicion(arr, { fechaInicio: "2026-01-01", fechaTermino: "2026-06-30" }),
    REF
  );
  assert.equal(igual.fechaTermino, "2026-06-30");

  const anticipada = await service.actualizar(
    propiedad,
    c1.id,
    edicion(arr, { fechaTermino: "2026-03-31" }),
    REF
  );
  assert.equal(anticipada.fechaTermino, "2026-03-31");
  assert.equal(anticipada.vigencia, "FINALIZADO");
});

// ---------- Concurrencia (bloqueo por propiedad) ----------

test("cinco altas simultáneas con solape en la misma propiedad: solo una se crea", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const resultados = await Promise.allSettled(
    Array.from({ length: 5 }, () => alta(propiedad, contrato(arr)))
  );
  const ok = resultados.filter((r) => r.status === "fulfilled");
  const rechazados = resultados.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(rechazados.length, 4);
  for (const r of rechazados) assert.ok(r.reason instanceof ConflictError);
  assert.equal(await prisma.contratoArriendo.count({ where: { propiedadId: propiedad } }), 1);
});

test("alta y edición simultáneas que juntas se solaparían: a lo sumo una se confirma", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  await alta(propiedad, contrato(arr, { fechaInicio: "2026-01-01", fechaTermino: "2026-06-30" }));
  const b = await alta(propiedad, contrato(arr, { fechaInicio: "2026-08-01", fechaTermino: "2026-12-31" }));

  // El alta ocupa 07-01..07-31; la edición lleva B a 07-15..12-31: se pisan.
  const resultados = await Promise.allSettled([
    alta(propiedad, contrato(arr, { fechaInicio: "2026-07-01", fechaTermino: "2026-07-31" })),
    service.actualizar(
      propiedad,
      b.id,
      edicion(arr, { fechaInicio: "2026-07-15", fechaTermino: "2026-12-31" }),
      REF
    ),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  const rechazado = resultados.find((r) => r.status === "rejected");
  assert.ok(rechazado && rechazado.status === "rejected" && rechazado.reason instanceof ConflictError);
  // A y B existían; el alta suma una fila solo si ganó la carrera.
  const altaGano = resultados[0].status === "fulfilled";
  assert.equal(
    await prisma.contratoArriendo.count({ where: { propiedadId: propiedad } }),
    altaGano ? 3 : 2
  );
});

test("altas simultáneas en propiedades distintas no se bloquean ni entran en conflicto", { skip }, async () => {
  const p1 = await nuevaPropiedad();
  const p2 = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const resultados = await Promise.allSettled([alta(p1, contrato(arr)), alta(p2, contrato(arr))]);
  assert.deepEqual(resultados.map((r) => r.status), ["fulfilled", "fulfilled"]);
});

// ---------- Autorización y arrendatario ----------

test("arrendatario inexistente o no UUID → NotFoundError y no se crea contrato", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  await assert.rejects(alta(propiedad, contrato(randomUUID())), NotFoundError);
  await assert.rejects(alta(propiedad, contrato("no-es-uuid")), NotFoundError);
  assert.equal(await prisma.contratoArriendo.count({ where: { propiedadId: propiedad } }), 0);
});

test("PUT con arrendatario inexistente conserva el original", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const c = await alta(propiedad, contrato(arr));
  await assert.rejects(
    service.actualizar(propiedad, c.id, edicion(randomUUID()), REF),
    NotFoundError
  );
  await assert.rejects(service.actualizar(propiedad, c.id, edicion("no-es-uuid"), REF), NotFoundError);
  assert.equal((await service.obtener(propiedad, c.id, REF)).arrendatario.id, arr);
});

test("PUT cambia a otro arrendatario existente", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const a1 = await nuevoArrendatario();
  const a2 = await nuevoArrendatario();
  const c = await alta(propiedad, contrato(a1));
  const dto = await service.actualizar(propiedad, c.id, edicion(a2), REF);
  assert.equal(dto.arrendatario.id, a2);
});

test("contrato bajo una propiedad ajena, inexistente o no UUID → NotFoundError; PUT nunca crea", { skip }, async () => {
  const p1 = await nuevaPropiedad();
  const p2 = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const c = await alta(p1, contrato(arr));
  await assert.rejects(service.obtener(p2, c.id, REF), NotFoundError);
  await assert.rejects(service.obtener(p1, randomUUID(), REF), NotFoundError);
  await assert.rejects(service.obtener(p1, "no-es-uuid", REF), NotFoundError);
  await assert.rejects(service.actualizar(p2, c.id, edicion(arr), REF), NotFoundError);
  await assert.rejects(service.actualizar(p1, randomUUID(), edicion(arr), REF), NotFoundError);
  assert.equal(await prisma.contratoArriendo.count({ where: { propiedadId: p2 } }), 0);
});

test("arrendatarios: RUT duplicado → ConflictError; sin RUT repetible; listado por nombre", { skip }, async () => {
  const rut = rutUnico();
  const a = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Beta Ficticio", rut }));
  arrendatariosCreados.push(a.id);
  await assert.rejects(
    arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Otro", rut })),
    ConflictError
  );
  const s1 = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Sin RUT 1" }));
  const s2 = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Sin RUT 2" }));
  arrendatariosCreados.push(s1.id, s2.id);
  const nombres = (await arrendatarios.listar()).map((x) => x.nombre);
  assert.ok(nombres.includes("Beta Ficticio"));
  assert.ok(nombres.indexOf("Beta Ficticio") < nombres.indexOf("Sin RUT 1"), "orden por nombre");
});

// ---------- Arrendatario anidado y transaccionalidad ----------

test("arrendatario anidado se crea junto al contrato", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const rut = rutUnico();
  const dto = await alta(
    propiedad,
    contratoCrearSchema.parse({
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      diaEsperadoPago: 10,
      arrendatario: { nombre: "Anidado Ficticio", rut },
    })
  );
  assert.equal(dto.arrendatario.rut, rut);
  assert.equal(dto.arrendatario.nombre, "Anidado Ficticio");
});

test("solape con arrendatario anidado revierte el arrendatario", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  await alta(propiedad, contrato(arr));
  const rut = rutUnico();
  await assert.rejects(
    alta(
      propiedad,
      contratoCrearSchema.parse({
        fechaInicio: "2026-06-01",
        fechaTermino: "2026-08-31",
        diaEsperadoPago: 10,
        arrendatario: { nombre: "No Debe Quedar", rut },
      })
    ),
    ConflictError
  );
  assert.equal(await prisma.arrendatario.findUnique({ where: { rut } }), null);
});

test("RUT duplicado en arrendatario anidado → ConflictError y no se crea contrato", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const rut = rutUnico();
  const existente = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Existente", rut }));
  arrendatariosCreados.push(existente.id);
  await assert.rejects(
    alta(
      propiedad,
      contratoCrearSchema.parse({
        fechaInicio: "2026-01-01",
        fechaTermino: "2026-12-31",
        diaEsperadoPago: 10,
        arrendatario: { nombre: "Duplicado", rut },
      })
    ),
    ConflictError
  );
  assert.equal(await prisma.contratoArriendo.count({ where: { propiedadId: propiedad } }), 0);
});

// ---------- Monto inicial (contrato_monto) ----------

test("alta con monto inicial: fila en contrato_monto desde el día 1 del mes de inicio", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const dto = await alta(
    propiedad,
    contrato(arr, { fechaInicio: "2026-03-15", fechaTermino: "2027-03-14", montoMensualClp: "500000" })
  );
  assert.equal(dto.montoInicialClp, "500000");
  const filas = await prisma.contratoMonto.findMany({ where: { contratoId: dto.id } });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].montoMensualClp.toString(), "500000");
  assert.equal(filas[0].vigenteDesdePeriodo.toISOString().slice(0, 10), "2026-03-01");
  assert.equal(filas[0].motivo, "monto inicial");
});

test("fallo al crear el monto revierte el contrato", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  // Se evita el esquema para forzar un monto que la columna NUMERIC(14,0) rechaza.
  const invalido = { ...contrato(arr), montoMensualClp: "99999999999999999" };
  await assert.rejects(alta(propiedad, invalido));
  assert.equal(await prisma.contratoArriendo.count({ where: { propiedadId: propiedad } }), 0);
});

test("PUT no altera ni sobrescribe el monto inicial", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const c = await alta(propiedad, contrato(arr, { montoMensualClp: "500000" }));
  const antes = await prisma.contratoMonto.findMany({ where: { contratoId: c.id } });

  const dto = await service.actualizar(
    propiedad,
    c.id,
    edicion(arr, {
      fechaTermino: "2026-09-30",
      diaEsperadoPago: 12,
      garantiaClp: "100000",
      montoMensualClp: "999999", // se descarta
    }),
    REF
  );
  assert.equal(dto.fechaTermino, "2026-09-30");
  assert.equal(dto.diaEsperadoPago, 12);
  assert.equal(dto.montoInicialClp, "500000");

  const despues = await prisma.contratoMonto.findMany({ where: { contratoId: c.id } });
  assert.equal(despues.length, 1);
  assert.equal(despues[0].id, antes[0].id);
  assert.equal(despues[0].montoMensualClp.toString(), "500000");
  assert.equal(despues[0].updatedAt.getTime(), antes[0].updatedAt.getTime());
});

test("cambiar el mes de inicio con monto inicial → ConflictError; mismo mes → ok; sin monto → ok", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const conMonto = await alta(
    propiedad,
    contrato(arr, { fechaInicio: "2026-03-10", fechaTermino: "2026-08-31", montoMensualClp: "500000" })
  );
  await assert.rejects(
    service.actualizar(propiedad, conMonto.id, edicion(arr, { fechaInicio: "2026-02-10", fechaTermino: "2026-08-31" }), REF),
    ConflictError
  );
  assert.equal((await service.obtener(propiedad, conMonto.id, REF)).fechaInicio, "2026-03-10");
  const mismoMes = await service.actualizar(
    propiedad,
    conMonto.id,
    edicion(arr, { fechaInicio: "2026-03-20", fechaTermino: "2026-08-31" }),
    REF
  );
  assert.equal(mismoMes.fechaInicio, "2026-03-20");

  const sinMonto = await alta(
    propiedad,
    contrato(arr, { fechaInicio: "2027-01-10", fechaTermino: "2027-06-30" })
  );
  const movido = await service.actualizar(
    propiedad,
    sinMonto.id,
    edicion(arr, { fechaInicio: "2026-11-10", fechaTermino: "2027-06-30" }),
    REF
  );
  assert.equal(movido.fechaInicio, "2026-11-10");
});

// ---------- Garantía y alcance ----------

test("la garantía es solo dato contractual: sin monto ni filas derivadas", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const dto = await alta(propiedad, contrato(arr, { garantiaClp: "750000" }));
  assert.equal(dto.garantiaClp, "750000");
  assert.equal(dto.montoInicialClp, null);
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: dto.id } }), 0);
  const cero = await alta(
    propiedad,
    contrato(arr, { fechaInicio: "2027-01-01", fechaTermino: "2027-12-31", garantiaClp: "0" })
  );
  assert.equal(cero.garantiaClp, "0");
});

test("CHECK de la base: término anterior, día fuera de rango y garantía negativa", { skip }, async () => {
  const propiedad = await nuevaPropiedad();
  const arr = await nuevoArrendatario();
  const data = {
    propiedadId: propiedad,
    arrendatarioId: arr,
    fechaInicio: new Date("2026-01-01T00:00:00Z"),
    fechaTermino: new Date("2026-12-31T00:00:00Z"),
    diaEsperadoPago: 5,
  };
  await assert.rejects(
    prisma.contratoArriendo.create({ data: { ...data, fechaTermino: new Date("2025-12-31T00:00:00Z") } })
  );
  await assert.rejects(prisma.contratoArriendo.create({ data: { ...data, diaEsperadoPago: 32 } }));
  await assert.rejects(prisma.contratoArriendo.create({ data: { ...data, garantiaClp: "-1" } }));
});
