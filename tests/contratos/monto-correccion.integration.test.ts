import { after, test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { UnprocessableError } from "../../server/errors";
import { abonoInputSchema } from "../../server/schemas/abono";
import { contratoCrearSchema, montoCorregirSchema, montoCrearSchema } from "../../server/schemas/contrato";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { createContratoService } from "../../server/services/contrato-service";
import { createPagoService } from "../../server/services/pago-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { resolveTestDatabase } from "../setup/test-db";

// Solo con TEST_DATABASE_URL (PostgreSQL de pruebas); se omite sin ella.
const { url, skip } = resolveTestDatabase();
const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: url });
const contratos = createContratoService(prisma);
const pagos = createPagoService(prisma);
const propiedades = createPropiedadService(prisma);
const HOY = "1990-07-15";
const props: string[] = [];
const arrs: string[] = [];

after(async () => {
  if (skip) return;
  const cs = await prisma.contratoArriendo.findMany({ where: { propiedadId: { in: props } }, select: { id: true } });
  const ids = cs.map((c) => c.id);
  await prisma.abonoArriendo.deleteMany({ where: { pagoEsperado: { contratoId: { in: ids } } } });
  await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: ids } } });
  await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: ids } } });
  await prisma.contratoArriendo.deleteMany({ where: { id: { in: ids } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: props } } });
  await prisma.arrendatario.deleteMany({ where: { id: { in: arrs } } });
  await prisma.$disconnect();
});

test("corregir montos: permitido sin abonos, bloqueado con abonos, abonos intactos", { skip }, async () => {
  const p = await propiedades.crear(
    propiedadInputSchema.parse({ numeroDepartamento: "TEST-MON-1", superficieM2: 40, valorCompraMonto: 2000, valorCompraMoneda: "UF", fechaCompra: "1989-05-10" })
  );
  props.push(p.id);
  const c = await contratos.crear(
    p.id,
    contratoCrearSchema.parse({
      fechaInicio: "1990-01-01",
      fechaTermino: "1990-12-31",
      diaEsperadoPago: 5,
      arrendatario: { nombre: "Arrendatario Ficticio" },
      montoMensualClp: "500000",
    }),
    HOY
  );
  arrs.push(c.arrendatario.id);
  const reaj = await contratos.registrarMonto(p.id, c.id, montoCrearSchema.parse({ montoMensualClp: "600000", vigenteDesdePeriodo: "1990-04" }));
  await contratos.sincronizarPagos(p.id, c.id, HOY);

  // Sin abonos: se puede corregir el reajuste.
  const ok = await contratos.corregirMonto(p.id, c.id, reaj.id, montoCorregirSchema.parse({ montoMensualClp: "650000" }));
  assert.equal(ok.pagosActualizados, 4); // abril a julio
  const lista = await pagos.listarPagos(p.id, c.id, HOY);
  assert.equal(lista.find((x) => x.periodo === "1990-05-01")?.montoEsperadoClp, "650000");
  assert.equal(lista.find((x) => x.periodo === "1990-03-01")?.montoEsperadoClp, "500000");

  // Con un abono en un período afectado: 422 y todo igual.
  const mayo = lista.find((x) => x.periodo === "1990-05-01");
  assert.ok(mayo);
  await pagos.crearAbono(p.id, c.id, mayo.id, abonoInputSchema.parse({ montoClp: "100000", fechaRecepcion: "1990-05-05" }), HOY);
  await assert.rejects(contratos.corregirMonto(p.id, c.id, reaj.id, montoCorregirSchema.parse({ montoMensualClp: "700000" })), UnprocessableError);
  await assert.rejects(contratos.eliminarMonto(p.id, c.id, reaj.id), UnprocessableError);
  assert.equal((await prisma.contratoMonto.findUniqueOrThrow({ where: { id: reaj.id } })).montoMensualClp.toString(), "650000");
  assert.equal(await prisma.abonoArriendo.count({ where: { pagoEsperadoId: mayo.id } }), 1);

  // registrarMonto aplica la misma protección: un reajuste retroactivo sobre mayo (con abono) se rechaza.
  await assert.rejects(contratos.registrarMonto(p.id, c.id, montoCrearSchema.parse({ montoMensualClp: "800000", vigenteDesdePeriodo: "1990-05" })), UnprocessableError);
  assert.equal(await prisma.contratoMonto.count({ where: { contratoId: c.id } }), 2);
});

test("concurrencia: registrar un reajuste y un abono a la vez deja un estado consistente", { skip }, async () => {
  const p = await propiedades.crear(
    propiedadInputSchema.parse({ numeroDepartamento: "TEST-MON-2", superficieM2: 40, valorCompraMonto: 2000, valorCompraMoneda: "UF", fechaCompra: "1989-05-10" })
  );
  props.push(p.id);
  const c = await contratos.crear(
    p.id,
    contratoCrearSchema.parse({ fechaInicio: "1990-01-01", fechaTermino: "1990-12-31", diaEsperadoPago: 5, arrendatario: { nombre: "Arrendatario Ficticio" }, montoMensualClp: "500000" }),
    HOY
  );
  arrs.push(c.arrendatario.id);
  await contratos.sincronizarPagos(p.id, c.id, HOY);
  const marzo = (await pagos.listarPagos(p.id, c.id, HOY)).find((x) => x.periodo === "1990-03-01");
  assert.ok(marzo);

  const [reaj, abono] = await Promise.allSettled([
    contratos.registrarMonto(p.id, c.id, montoCrearSchema.parse({ montoMensualClp: "650000", vigenteDesdePeriodo: "1990-03" })),
    pagos.crearAbono(p.id, c.id, marzo.id, abonoInputSchema.parse({ montoClp: "100000", fechaRecepcion: "1990-03-05" }), HOY),
  ]);
  assert.equal(abono.status, "fulfilled"); // el abono siempre se registra
  const fila = await prisma.contratoMonto.count({ where: { contratoId: c.id, montoMensualClp: "650000" } });
  const esperado = (await prisma.pagoEsperado.findUniqueOrThrow({ where: { id: marzo.id } })).montoEsperadoClp.toString();
  // O el reajuste entró antes que el abono (pago en 650000) o se rechazó por el abono (pago intacto en 500000).
  if (reaj.status === "fulfilled") {
    assert.equal(fila, 1);
    assert.equal(esperado, "650000");
  } else {
    assert.ok(reaj.reason instanceof UnprocessableError);
    assert.equal(fila, 0);
    assert.equal(esperado, "500000");
  }
});
