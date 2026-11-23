import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { ConflictError } from "../../server/errors";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import { contratoCrearSchema } from "../../server/schemas/contrato";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { resolveTestDatabase } from "../setup/test-db";

// Solo con TEST_DATABASE_URL (PostgreSQL de pruebas); se omite sin ella.
const { url, skip } = resolveTestDatabase();
const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: url });
const arrendatarios = createArrendatarioService(prisma);
const contratos = createContratoService(prisma);
const propiedades = createPropiedadService(prisma);
const HOY = "1991-06-15";
const props: string[] = [];
const arrs: string[] = [];

after(async () => {
  if (skip) return;
  const cs = await prisma.contratoArriendo.findMany({ where: { propiedadId: { in: props } }, select: { id: true } });
  const ids = cs.map((c) => c.id);
  await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: ids } } });
  await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: ids } } });
  await prisma.contratoArriendo.deleteMany({ where: { id: { in: ids } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
  await prisma.arrendatario.deleteMany({ where: { id: { in: arrs } } });
  await prisma.$disconnect();
});

test("editar un arrendatario conserva su id y sus contratos; el RUT duplicado da 409", { skip }, async () => {
  const p = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-EDA-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "1990-05-10",
    })
  );
  props.push(p.id);
  const a = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Original", rut: "T-EDA-1" }));
  const b = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Otro", rut: "T-EDA-2" }));
  arrs.push(a.id, b.id);
  const c = await contratos.crear(
    p.id,
    contratoCrearSchema.parse({
      fechaInicio: "1991-01-01",
      fechaTermino: "1991-12-31",
      diaEsperadoPago: 5,
      arrendatarioId: a.id,
      montoMensualClp: "600000",
    }),
    HOY
  );

  const editado = await arrendatarios.actualizar(a.id, arrendatarioInputSchema.parse({ nombre: "Corregido", rut: "T-EDA-1", email: "x@y.cl" }));
  assert.equal(editado.id, a.id);
  const despues = await contratos.obtener(p.id, c.id, HOY);
  assert.equal(despues.arrendatario.id, a.id);
  assert.equal(despues.arrendatario.nombre, "Corregido");

  await assert.rejects(arrendatarios.actualizar(a.id, arrendatarioInputSchema.parse({ nombre: "Corregido", rut: "T-EDA-2" })), ConflictError);
  assert.equal((await arrendatarios.obtener(a.id)).rut, "T-EDA-1");
});
