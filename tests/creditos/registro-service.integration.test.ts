import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { ConflictError, NotFoundError } from "../../server/errors";
import { creditoInputSchema } from "../../server/schemas/credito";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import {
  registroMensualActualizarSchema,
  registroMensualCrearSchema,
} from "../../server/schemas/credito-registro";
import { resolveTestDatabase } from "../setup/test-db";

// Integración contra PostgreSQL real. Solo corre con TEST_DATABASE_URL explícita
// y distinta de DATABASE_URL/DIRECT_URL (ver tests/setup/test-db.ts); si no,
// se omite sin escribir nada. Cada prueba borra únicamente lo que creó, por id
// (registros → crédito → propiedad, por las FK Restrict).
const { url: testUrl, skip } = resolveTestDatabase();

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const creditos = createCreditoService(prisma);
const service = createCreditoRegistroService(prisma);
const propiedadesCreadas: string[] = [];

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
    await prisma.creditoHipotecario.deleteMany({
      where: { propiedadId: { in: propiedadesCreadas } },
    });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.$disconnect();
});

async function nuevaPropiedad(conCredito = true) {
  const dto = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-REG-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(dto.id);
  if (conCredito) {
    await creditos.crear(
      dto.id,
      creditoInputSchema.parse({
        banco: "Banco Ficticio",
        cuotaContractualUf: "12.3456",
        tasaInteresAnual: "4.1250",
        numeroCuotasTotal: 240,
        diaVencimiento: 5,
      })
    );
  }
  return dto.id;
}

const crear = (extra: Record<string, unknown>) =>
  registroMensualCrearSchema.parse({ periodo: "2026-03", ...extra });
const actualizar = (extra: Record<string, unknown>) =>
  registroMensualActualizarSchema.parse(extra);

test("alta con dividendo, fecha y saldo: round-trip exacto y período ≠ fecha de pago", { skip }, async () => {
  const id = await nuevaPropiedad();
  const dto = await service.crear(
    id,
    crear({
      dividendoPagadoClp: "412345",
      fechaPagoDividendo: "2026-04-03",
      saldoPendienteUf: "1799.9999",
    })
  );
  assert.deepEqual(dto, {
    periodo: "2026-03",
    registrado: true,
    dividendoPagadoClp: "412345",
    fechaPagoDividendo: "2026-04-03",
    saldoPendienteUf: "1799.9999",
  });
  assert.deepEqual(await service.obtenerPorPeriodo(id, "2026-03"), dto);
});

test("alta solo con saldo y alta solo con dividendo", { skip }, async () => {
  const id = await nuevaPropiedad();
  const soloSaldo = await service.crear(id, crear({ periodo: "2026-01", saldoPendienteUf: "0" }));
  assert.equal(soloSaldo.dividendoPagadoClp, null);
  assert.equal(soloSaldo.fechaPagoDividendo, null);
  assert.equal(soloSaldo.saldoPendienteUf, "0");
  const soloDiv = await service.crear(
    id,
    crear({ periodo: "2026-02", dividendoPagadoClp: "100", fechaPagoDividendo: "2026-02-05" })
  );
  assert.equal(soloDiv.saldoPendienteUf, null);
});

test("período duplicado → ConflictError", { skip }, async () => {
  const id = await nuevaPropiedad();
  await service.crear(id, crear({ saldoPendienteUf: "10" }));
  await assert.rejects(service.crear(id, crear({ saldoPendienteUf: "20" })), ConflictError);
  assert.equal((await service.obtenerPorPeriodo(id, "2026-03")).saldoPendienteUf, "10");
});

test("propiedad inexistente, id no UUID o sin crédito → NotFoundError", { skip }, async () => {
  const sinCredito = await nuevaPropiedad(false);
  for (const id of ["00000000-0000-4000-8000-000000000000", "no-uuid", sinCredito]) {
    await assert.rejects(service.crear(id, crear({ saldoPendienteUf: "1" })), NotFoundError);
    await assert.rejects(service.listar(id), NotFoundError);
    await assert.rejects(service.obtenerPorPeriodo(id, "2026-03"), NotFoundError);
    await assert.rejects(service.actualizar(id, "2026-03", actualizar({ saldoPendienteUf: "1" })), NotFoundError);
  }
});

test("meses en cualquier orden; historial del más reciente al más antiguo; incluye futuros", { skip }, async () => {
  const id = await nuevaPropiedad();
  for (const periodo of ["2026-03", "2026-01", "2099-12", "2026-02"]) {
    await service.crear(id, crear({ periodo, saldoPendienteUf: "5" }));
  }
  const periodos = (await service.listar(id)).map((r) => r.periodo);
  assert.deepEqual(periodos, ["2099-12", "2026-03", "2026-02", "2026-01"]);
});

test("crédito sin registros → lista vacía", { skip }, async () => {
  assert.deepEqual(await service.listar(await nuevaPropiedad()), []);
});

test("mes anterior devuelve sus propios valores; mes sin registro no estima ni arrastra", { skip }, async () => {
  const id = await nuevaPropiedad();
  await service.crear(id, crear({ periodo: "2026-01", saldoPendienteUf: "100" }));
  await service.crear(id, crear({ periodo: "2026-03", saldoPendienteUf: "90" }));
  assert.equal((await service.obtenerPorPeriodo(id, "2026-01")).saldoPendienteUf, "100");
  assert.deepEqual(await service.obtenerPorPeriodo(id, "2026-02"), {
    periodo: "2026-02",
    registrado: false,
    dividendoPagadoClp: null,
    fechaPagoDividendo: null,
    saldoPendienteUf: null,
  });
});

test("actualizar modifica solo ese período y nunca crea", { skip }, async () => {
  const id = await nuevaPropiedad();
  await service.crear(id, crear({ periodo: "2026-01", saldoPendienteUf: "100" }));
  await service.crear(id, crear({ periodo: "2026-02", saldoPendienteUf: "90" }));
  const dto = await service.actualizar(
    id,
    "2026-01",
    actualizar({ saldoPendienteUf: "99.5", dividendoPagadoClp: "5000", fechaPagoDividendo: "2026-01-10" })
  );
  assert.equal(dto.saldoPendienteUf, "99.5");
  assert.equal(dto.dividendoPagadoClp, "5000");
  assert.equal((await service.obtenerPorPeriodo(id, "2026-02")).saldoPendienteUf, "90");
  await assert.rejects(
    service.actualizar(id, "2026-05", actualizar({ saldoPendienteUf: "1" })),
    NotFoundError
  );
  assert.equal((await service.obtenerPorPeriodo(id, "2026-05")).registrado, false);
});

test("los CHECK de la BD rechazan escrituras que violan las reglas", { skip }, async () => {
  const id = await nuevaPropiedad();
  const credito = await prisma.creditoHipotecario.findUniqueOrThrow({ where: { propiedadId: id } });
  const base = { creditoId: credito.id, periodo: new Date("2026-03-01T00:00:00Z") };
  const fecha = new Date("2026-03-05T00:00:00Z");
  const invalidas = [
    { ...base }, // ni saldo ni dividendo
    { ...base, dividendoPagadoClp: 100 }, // dividendo sin fecha
    { ...base, saldoPendienteUf: 1, fechaPagoDividendo: fecha }, // fecha sin dividendo
    { ...base, dividendoPagadoClp: 0, fechaPagoDividendo: fecha }, // dividendo no positivo
    { ...base, saldoPendienteUf: -1 }, // saldo negativo
    { creditoId: credito.id, periodo: new Date("2026-03-15T00:00:00Z"), saldoPendienteUf: 1 }, // no día 1
  ];
  for (const data of invalidas) {
    await assert.rejects(prisma.creditoRegistroMensual.create({ data }));
  }
  assert.equal((await service.listar(id)).length, 0);
});

test("último saldo registrado ignora filas solo-dividendo; sin saldos → null", { skip }, async () => {
  const id = await nuevaPropiedad();
  assert.equal(await service.ultimoSaldoRegistrado(id), null);
  await service.crear(id, crear({ periodo: "2026-01", saldoPendienteUf: "100" }));
  await service.crear(
    id,
    crear({ periodo: "2026-02", dividendoPagadoClp: "100", fechaPagoDividendo: "2026-02-05" })
  );
  assert.deepEqual(await service.ultimoSaldoRegistrado(id), {
    periodo: "2026-01",
    saldoPendienteUf: "100",
  });
});

test("registrar un dividendo no crea otras filas fuera de credito_registro_mensual", { skip }, async () => {
  const id = await nuevaPropiedad();
  const antes = await prisma.creditoHipotecario.count({ where: { propiedadId: id } });
  await service.crear(
    id,
    crear({ dividendoPagadoClp: "100", fechaPagoDividendo: "2026-03-05" })
  );
  assert.equal(await prisma.creditoHipotecario.count({ where: { propiedadId: id } }), antes);
});
