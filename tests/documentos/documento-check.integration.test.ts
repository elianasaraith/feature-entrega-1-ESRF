import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { resolveTestDatabase } from "../setup/test-db";

// Restricciones de la tabla documento. Requiere PostgreSQL de pruebas con la
// migración add_documento aplicada; se omite sin TEST_DATABASE_URL.
const { url, skip } = resolveTestDatabase();
const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: url });
const props: string[] = [];

after(async () => {
  if (skip) return;
  await prisma.documento.deleteMany({ where: { propiedadId: { in: props } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
  await prisma.$disconnect();
});

test("la base rechaza tamaño no positivo y dos vínculos, y acepta un documento válido", { skip }, async () => {
  const p = await createPropiedadService(prisma).crear(
    propiedadInputSchema.parse({ numeroDepartamento: "TEST-DOC-1", superficieM2: 40, valorCompraMonto: 2000, valorCompraMoneda: "UF", fechaCompra: "1989-05-10" })
  );
  props.push(p.id);
  const base = { propiedadId: p.id, tipo: "OTRO" as const, nombreArchivo: "a.pdf", mimeType: "application/pdf" };
  await assert.rejects(prisma.documento.create({ data: { ...base, tamanoBytes: BigInt(0), storageKey: `test/${p.id}/0` } }));
  const ok = await prisma.documento.create({ data: { ...base, tamanoBytes: BigInt(10), storageKey: `test/${p.id}/1` } });
  assert.equal(ok.propiedadId, p.id);
  // Dos vínculos específicos a la vez (ids ficticios): rechazado por CHECK (o por FK).
  await assert.rejects(
    prisma.$executeRaw`INSERT INTO documento (id, propiedad_id, credito_id, contrato_id, tipo, nombre_archivo, mime_type, tamano_bytes, storage_key)
      VALUES (gen_random_uuid(), ${p.id}::uuid, gen_random_uuid(), gen_random_uuid(), 'OTRO', 'a', 'application/pdf', 1, ${`test/${p.id}/2`})`
  );
});
