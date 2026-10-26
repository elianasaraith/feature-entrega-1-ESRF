import { Prisma } from "@prisma/client";
import type { CreditoHipotecario, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import type { CreditoInput } from "@/server/schemas/credito";

export type CreditoDto = {
  id: string;
  propiedadId: string;
  banco: string;
  numeroCredito: string | null;
  fechaOtorgamiento: string | null;
  montoOriginalUf: string | null;
  cuotaContractualUf: string;
  tasaInteresAnual: string;
  numeroCuotasTotal: number;
  segurosUf: string | null;
  diaVencimiento: number;
  saldoInicialUf: string | null;
  createdAt: string;
  updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIN_PROPIEDAD = "Propiedad no encontrada";
const SIN_CREDITO = "La propiedad no tiene crédito hipotecario";

// Decimal → texto: nunca pasa por Number.
function toDto(c: CreditoHipotecario): CreditoDto {
  return {
    id: c.id,
    propiedadId: c.propiedadId,
    banco: c.banco,
    numeroCredito: c.numeroCredito,
    fechaOtorgamiento: c.fechaOtorgamiento?.toISOString().slice(0, 10) ?? null,
    montoOriginalUf: c.montoOriginalUf?.toString() ?? null,
    cuotaContractualUf: c.cuotaContractualUf.toString(),
    tasaInteresAnual: c.tasaInteresAnual.toString(),
    numeroCuotasTotal: c.numeroCuotasTotal,
    segurosUf: c.segurosUf?.toString() ?? null,
    diaVencimiento: c.diaVencimiento,
    saldoInicialUf: c.saldoInicialUf?.toString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function toData(input: CreditoInput) {
  return {
    ...input,
    fechaOtorgamiento: input.fechaOtorgamiento
      ? new Date(`${input.fechaOtorgamiento}T00:00:00.000Z`)
      : null,
  };
}

function isKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// El cliente Prisma se inyecta para poder probar contra una BD de pruebas
// independiente sin tocar la de desarrollo.
export function createCreditoService(prisma: PrismaClient) {
  async function asegurarPropiedad(propiedadId: string): Promise<void> {
    if (!UUID.test(propiedadId)) throw new NotFoundError(SIN_PROPIEDAD);
    const propiedad = await prisma.propiedad.findUnique({
      where: { id: propiedadId },
      select: { id: true },
    });
    if (!propiedad) throw new NotFoundError(SIN_PROPIEDAD);
  }

  async function obtenerPorPropiedad(propiedadId: string): Promise<CreditoDto> {
    await asegurarPropiedad(propiedadId);
    const row = await prisma.creditoHipotecario.findUnique({ where: { propiedadId } });
    if (!row) throw new NotFoundError(SIN_CREDITO);
    return toDto(row);
  }

  return {
    obtenerPorPropiedad,

    async crear(propiedadId: string, input: CreditoInput): Promise<CreditoDto> {
      await asegurarPropiedad(propiedadId);
      try {
        return toDto(
          await prisma.creditoHipotecario.create({
            data: { ...toData(input), propiedadId },
          })
        );
      } catch (error) {
        // UNIQUE(propiedad_id): también cubre la carrera entre dos POST.
        if (isKnownError(error, "P2002")) {
          throw new ConflictError("La propiedad ya tiene un crédito hipotecario");
        }
        throw error;
      }
    },

    // Solo actualiza un crédito existente; nunca lo crea.
    async actualizar(propiedadId: string, input: CreditoInput): Promise<CreditoDto> {
      await asegurarPropiedad(propiedadId);
      const { count } = await prisma.creditoHipotecario.updateMany({
        where: { propiedadId },
        data: toData(input),
      });
      if (count === 0) throw new NotFoundError(SIN_CREDITO);
      return obtenerPorPropiedad(propiedadId);
    },
  };
}
