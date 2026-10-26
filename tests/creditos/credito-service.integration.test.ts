import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createCreditoService } from "../../server/services/credito-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { ConflictError, NotFoundError } from "../../server/errors";
import { creditoInputSchema } from "../../server/schemas/credito";
import { propiedadInputSchema } from "../../server/schemas/propiedad";

// Integración contra PostgreSQL real. Exige TEST_DATABASE_URL explícita y
// distinta de la BD de desarrollo; sin ella, las pruebas se omiten. Nunca usa
// DATABASE_URL como alternativa. Cada prueba borra únicamente las filas que
// ella misma creó (crédito antes que propiedad, por la FK Restrict).
const testUrl = process.env.TEST_DATABASE_URL;
const devUrls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean);
const skip = !testUrl
  ? "TEST_DATABASE_URL no definida"
  : devUrls.includes(testUrl)
    ? "TEST_DATABASE_URL apunta a la BD de desarrollo"
    : false;

const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const service = createCreditoService(prisma);
const propiedadesCreadas: string[] = [];

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    await prisma.creditoHipotecario.deleteMany({
      where: { propiedadId: { in: propiedadesCreadas } },
    });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.$disconnect();
});

async function nuevaPropiedad() {
  const dto = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-CRED-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(dto.id);
  return dto.id;
}

const obligatorios = {
  banco: "Banco Ficticio",
  cuotaContractualUf: "12.3456",
  tasaInteresAnual: "4.1250",
  numeroCuotasTotal: 240,
  diaVencimiento: 5,
};

const input = (extra: Record<string, unknown> = {}) =>
  creditoInputSchema.parse({ ...obligatorios, ...extra });

test("alta con todos los datos y round-trip decimal exacto", { skip }, async () => {
  const id = await nuevaPropiedad();
  const dto = await service.crear(
    id,
    input({
      numeroCredito: "X-1",
      fechaOtorgamiento: "2024-06-01",
      montoOriginalUf: "1800.1234",
      segurosUf: "0.5",
      saldoInicialUf: "1799.9999",
    })
  );
  assert.equal(dto.propiedadId, id);
  assert.equal(dto.cuotaContractualUf, "12.3456");
  assert.equal(dto.tasaInteresAnual, "4.125");
  assert.equal(dto.montoOriginalUf, "1800.1234");
  assert.equal(dto.saldoInicialUf, "1799.9999");
  assert.equal(dto.fechaOtorgamiento, "2024-06-01");
  assert.deepEqual(await service.obtenerPorPropiedad(id), dto);
});

test("alta solo con obligatorios: opcionales en null", { skip }, async () => {
  const dto = await service.crear(await nuevaPropiedad(), input());
  assert.equal(dto.numeroCredito, null);
  assert.equal(dto.fechaOtorgamiento, null);
  assert.equal(dto.montoOriginalUf, null);
  assert.equal(dto.segurosUf, null);
  assert.equal(dto.saldoInicialUf, null);
});

test("segundo crédito para la misma propiedad → ConflictError sin alterar el primero", { skip }, async () => {
  const id = await nuevaPropiedad();
  const primero = await service.crear(id, input());
  await assert.rejects(service.crear(id, input({ banco: "Otro" })), ConflictError);
  assert.deepEqual(await service.obtenerPorPropiedad(id), primero);
});

test("propiedad sin crédito → obtener y actualizar dan NotFoundError; actualizar no crea", { skip }, async () => {
  const id = await nuevaPropiedad();
  await assert.rejects(service.obtenerPorPropiedad(id), NotFoundError);
  await assert.rejects(service.actualizar(id, input()), NotFoundError);
  assert.equal(await prisma.creditoHipotecario.count({ where: { propiedadId: id } }), 0);
});

test("propiedad inexistente o id no UUID → NotFoundError", { skip }, async () => {
  const inexistente = "00000000-0000-4000-8000-000000000000";
  for (const id of [inexistente, "no-es-uuid"]) {
    await assert.rejects(service.obtenerPorPropiedad(id), NotFoundError);
    await assert.rejects(service.crear(id, input()), NotFoundError);
    await assert.rejects(service.actualizar(id, input()), NotFoundError);
  }
});

test("actualizar reemplaza las condiciones del crédito existente", { skip }, async () => {
  const id = await nuevaPropiedad();
  const original = await service.crear(id, input({ segurosUf: "1" }));
  const dto = await service.actualizar(id, input({ banco: "Banco B", diaVencimiento: 31 }));
  assert.equal(dto.id, original.id);
  assert.equal(dto.banco, "Banco B");
  assert.equal(dto.diaVencimiento, 31);
  assert.equal(dto.segurosUf, null);
});

test("los CHECK de PostgreSQL rechazan datos que eludan Zod", { skip }, async () => {
  const id = await nuevaPropiedad();
  const base = {
    propiedadId: id,
    banco: "B",
    cuotaContractualUf: "1",
    tasaInteresAnual: "1",
    numeroCuotasTotal: 12,
    diaVencimiento: 5,
  };
  const invalidos: Record<string, unknown>[] = [
    { cuotaContractualUf: "0" },
    { tasaInteresAnual: "-1" },
    { numeroCuotasTotal: 0 },
    { diaVencimiento: 0 },
    { diaVencimiento: 32 },
    { montoOriginalUf: "0" },
    { segurosUf: "-1" },
    { saldoInicialUf: "-1" },
  ];
  for (const extra of invalidos) {
    await assert.rejects(prisma.creditoHipotecario.create({ data: { ...base, ...extra } }), (e) => {
      assert.ok(e instanceof Error);
      return true;
    }, JSON.stringify(extra));
  }
  assert.equal(await prisma.creditoHipotecario.count({ where: { propiedadId: id } }), 0);
});

test("la FK Restrict impide borrar una propiedad con crédito", { skip }, async () => {
  const id = await nuevaPropiedad();
  await service.crear(id, input());
  await assert.rejects(prisma.propiedad.delete({ where: { id } }));
});
