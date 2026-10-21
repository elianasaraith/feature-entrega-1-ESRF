import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { NotFoundError } from "../../server/errors";
import { propiedadInputSchema } from "../../server/schemas/propiedad";

// Integración contra PostgreSQL real. Exige TEST_DATABASE_URL explícita y
// distinta de la BD de desarrollo; sin ella, las pruebas se omiten. Nunca usa
// DATABASE_URL. Cada prueba borra únicamente las filas que ella misma creó.
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
const service = createPropiedadService(prisma);
const creados: string[] = [];

after(async () => {
  if (skip) return;
  if (creados.length) await prisma.propiedad.deleteMany({ where: { id: { in: creados } } });
  await prisma.$disconnect();
});

const base = {
  numeroDepartamento: "TEST-701",
  superficieM2: 40,
  valorCompraMonto: 2000,
  valorCompraMoneda: "UF",
  fechaCompra: "2024-05-10",
};

async function crear(extra: Record<string, unknown> = {}) {
  const dto = await service.crear(propiedadInputSchema.parse({ ...base, ...extra }));
  creados.push(dto.id);
  return dto;
}

test("alta con estacionamiento y bodega", { skip }, async () => {
  const dto = await crear({ estacionamiento: "E-7", bodega: "B-7" });
  assert.equal(dto.estacionamiento, "E-7");
  assert.equal(dto.bodega, "B-7");
  assert.equal(dto.fechaCompra, "2024-05-10");
  assert.equal(dto.valorCompraMoneda, "UF");
  assert.deepEqual(await service.obtener(dto.id), dto);
});

test("alta sin estacionamiento ni bodega: ambos ausentes", { skip }, async () => {
  const dto = await crear();
  assert.equal(dto.estacionamiento, null);
  assert.equal(dto.bodega, null);
});

test("listar incluye la propiedad creada", { skip }, async () => {
  const dto = await crear();
  assert.ok((await service.listar()).some((p) => p.id === dto.id));
});

test("actualizar reemplaza los datos editables", { skip }, async () => {
  const dto = await crear({ estacionamiento: "E-9" });
  const actualizado = await service.actualizar(
    dto.id,
    propiedadInputSchema.parse({ ...base, numeroDepartamento: "TEST-702", valorCompraMoneda: "CLP", valorCompraMonto: 90000000 })
  );
  assert.equal(actualizado.numeroDepartamento, "TEST-702");
  assert.equal(actualizado.valorCompraMoneda, "CLP");
  assert.equal(actualizado.estacionamiento, null);
});

test("obtener/actualizar inexistente o no UUID → NotFoundError", { skip }, async () => {
  const input = propiedadInputSchema.parse(base);
  const inexistente = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(service.obtener(inexistente), NotFoundError);
  await assert.rejects(service.obtener("no-es-uuid"), NotFoundError);
  await assert.rejects(service.actualizar(inexistente, input), NotFoundError);
});

test("los CHECK de PostgreSQL rechazan datos que eludan Zod", { skip }, async () => {
  await assert.rejects(
    prisma.propiedad.create({
      data: { ...base, superficieM2: 0, valorCompraMoneda: "UF", fechaCompra: new Date("2024-05-10") },
    })
  );
});
