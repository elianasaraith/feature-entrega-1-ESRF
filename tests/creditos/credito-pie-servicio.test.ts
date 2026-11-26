import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { creditoInputSchema } from "../../server/schemas/credito";
import { createCreditoService } from "../../server/services/credito-service";

// Servicio del crédito con un doble de Prisma en memoria (sin base de datos):
// creación, edición, quitar el pie, 0 vs null, pieEstimado y créditos existentes.
const PROPIEDAD_ID = "11111111-1111-4111-8111-111111111111";
type Fila = Record<string, unknown> & { propiedadId: string };

function fake(valor: { monto: string; moneda: "UF" | "CLP" }, existente?: Fila) {
  let credito: Fila | undefined = existente;
  const dec = (v: unknown) => (v === null || v === undefined ? null : new Prisma.Decimal(v as string));
  const fila = (data: Record<string, unknown>): Fila => ({
    id: "22222222-2222-4222-8222-222222222222",
    createdAt: new Date(),
    updatedAt: new Date(),
    numeroCredito: null,
    fechaOtorgamiento: null,
    ...data,
    cuotaContractualUf: dec(data.cuotaContractualUf),
    tasaInteresAnual: dec(data.tasaInteresAnual),
    montoOriginalUf: dec(data.montoOriginalUf),
    segurosUf: dec(data.segurosUf),
    saldoInicialUf: dec(data.saldoInicialUf),
    porcentajePie: dec(data.porcentajePie),
  }) as unknown as Fila;
  const prisma = {
    propiedad: {
      findUnique: async () => ({
        id: PROPIEDAD_ID,
        valorCompraMonto: new Prisma.Decimal(valor.monto),
        valorCompraMoneda: valor.moneda,
      }),
    },
    creditoHipotecario: {
      findUnique: async () => credito ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => (credito = fila(data)),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (!credito) return { count: 0 };
        credito = fila({ ...data, propiedadId: credito.propiedadId, id: credito.id });
        return { count: 1 };
      },
    },
    creditoRegistroMensual: { findFirst: async () => null },
  };
  return createCreditoService(prisma as unknown as PrismaClient);
}

const obligatorios = {
  banco: "Banco Ficticio",
  cuotaContractualUf: "12.3456",
  tasaInteresAnual: "4.1250",
  numeroCuotasTotal: 240,
  diaVencimiento: 5,
};
const input = (extra: Record<string, unknown> = {}) => creditoInputSchema.parse({ ...obligatorios, ...extra });

test("alta con porcentaje válido: se devuelve y calcula el pie en UF", async () => {
  const service = fake({ monto: "2000", moneda: "UF" });
  const dto = await service.crear(PROPIEDAD_ID, input({ porcentajePie: "20" }));
  assert.equal(dto.porcentajePie, "20");
  const consulta = await service.obtenerConEquivalentes(PROPIEDAD_ID);
  assert.deepEqual(consulta.pieEstimado, { montoEstimado: "400.0000", moneda: "UF", restoPorcentaje: "80" });
  // Campos previos intactos (solo se añade).
  assert.equal(consulta.cuotaContractualUf, "12.3456");
  assert.equal(consulta.montoOriginalUf, null);
});

test("pie sobre valor de compra en CLP: monto CLP entero", async () => {
  const service = fake({ monto: "100000000", moneda: "CLP" });
  await service.crear(PROPIEDAD_ID, input({ porcentajePie: "12.5" }));
  const { pieEstimado } = await service.obtenerConEquivalentes(PROPIEDAD_ID);
  assert.deepEqual(pieEstimado, { montoEstimado: "12500000", moneda: "CLP", restoPorcentaje: "87.5" });
});

test("alta sin el campo: null y sin pieEstimado (compatibilidad)", async () => {
  const service = fake({ monto: "2000", moneda: "UF" });
  const dto = await service.crear(PROPIEDAD_ID, input());
  assert.equal(dto.porcentajePie, null);
  assert.equal((await service.obtenerConEquivalentes(PROPIEDAD_ID)).pieEstimado, null);
});

test("0 se conserva como 0 y es distinto de null", async () => {
  const service = fake({ monto: "2000", moneda: "UF" });
  const dto = await service.crear(PROPIEDAD_ID, input({ porcentajePie: "0" }));
  assert.equal(dto.porcentajePie, "0");
  const { pieEstimado } = await service.obtenerConEquivalentes(PROPIEDAD_ID);
  assert.equal(pieEstimado?.montoEstimado, "0.0000");
  assert.equal(pieEstimado?.restoPorcentaje, "100");
});

test("100 % y decimales se conservan sin pérdida", async () => {
  const service = fake({ monto: "2000", moneda: "UF" });
  assert.equal((await service.crear(PROPIEDAD_ID, input({ porcentajePie: "100" }))).porcentajePie, "100");
  assert.equal((await service.actualizar(PROPIEDAD_ID, input({ porcentajePie: "33.33" }))).porcentajePie, "33.33");
});

test("edición: cambia el porcentaje y luego lo quita con vacío o null", async () => {
  const service = fake({ monto: "2000", moneda: "UF" });
  await service.crear(PROPIEDAD_ID, input({ porcentajePie: "10" }));
  assert.equal((await service.actualizar(PROPIEDAD_ID, input({ porcentajePie: "25.5" }))).porcentajePie, "25.5");
  assert.equal((await service.actualizar(PROPIEDAD_ID, input({ porcentajePie: "" }))).porcentajePie, null);
  await service.actualizar(PROPIEDAD_ID, input({ porcentajePie: "5" }));
  assert.equal((await service.actualizar(PROPIEDAD_ID, input({ porcentajePie: null }))).porcentajePie, null);
});

test("crédito existente sin porcentaje: consulta intacta con porcentajePie null", async () => {
  const antiguo = {
    id: "22222222-2222-4222-8222-222222222222",
    propiedadId: PROPIEDAD_ID,
    banco: "Banco Ficticio",
    numeroCredito: null,
    fechaOtorgamiento: null,
    montoOriginalUf: new Prisma.Decimal("1800"),
    cuotaContractualUf: new Prisma.Decimal("12.3456"),
    tasaInteresAnual: new Prisma.Decimal("4.125"),
    numeroCuotasTotal: 240,
    segurosUf: null,
    diaVencimiento: 5,
    saldoInicialUf: null,
    // sin `porcentajePie`: fila anterior a la migración leída como null por Prisma
    porcentajePie: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Fila;
  const consulta = await fake({ monto: "2000", moneda: "UF" }, antiguo).obtenerConEquivalentes(PROPIEDAD_ID);
  assert.equal(consulta.porcentajePie, null);
  assert.equal(consulta.pieEstimado, null);
  assert.equal(consulta.montoOriginalUf, "1800");
  assert.equal(consulta.cuotaContractualUf, "12.3456");
});
