import { Prisma } from "@prisma/client";
import type { CreditoHipotecario, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import { hoyChile } from "@/server/clock";
import type { CreditoInput } from "@/server/schemas/credito";
import { calcularEquivalenteClp } from "@/server/uf/equivalente";
import type { EquivalenteClpDto } from "@/server/uf/equivalente";
import type { UfService, ValorUfDto } from "@/server/uf/uf-service";
import { calcularPieEstimado } from "@/server/domain/credito-pie";
import type { PieEstimadoDto } from "@/server/domain/credito-pie";
import { createCreditoRegistroService } from "./credito-registro-service";
import type { UltimoSaldoDto } from "./credito-registro-service";
import {
  SIN_CREDITO,
  asegurarPropiedad as verificarPropiedad,
} from "./propiedad-lookup";

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
  porcentajePie: string | null; // 0..100; null = no informado (distinto de "0")
  createdAt: string;
  updatedAt: string;
};

// Consulta del crédito con equivalentes en CLP (T10). Solo añade campos: los de
// CreditoDto no cambian. `null` = equivalente no disponible.
export type UltimoSaldoConEquivalenteDto = UltimoSaldoDto & { equivalenteClp: EquivalenteClpDto };
export type CreditoConEquivalentesDto = CreditoDto & {
  cuotaContractualClp: EquivalenteClpDto; // UF del mes actual
  saldoInicialClp: EquivalenteClpDto; // UF del mes de fechaOtorgamiento
  ultimoSaldo: UltimoSaldoConEquivalenteDto | null; // UF del período del registro
  pieEstimado: PieEstimadoDto | null; // null si porcentajePie es null
};

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
    porcentajePie: c.porcentajePie?.toString() ?? null,
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
// `uf` es opcional: sin él, todo equivalente en CLP es null.
export function createCreditoService(prisma: PrismaClient, uf?: UfService) {
  const registros = createCreditoRegistroService(prisma);
  const asegurarPropiedad = (propiedadId: string) => verificarPropiedad(prisma, propiedadId);

  async function obtenerPorPropiedad(propiedadId: string): Promise<CreditoDto> {
    await asegurarPropiedad(propiedadId);
    const row = await prisma.creditoHipotecario.findUnique({ where: { propiedadId } });
    if (!row) throw new NotFoundError(SIN_CREDITO);
    return toDto(row);
  }

  // Un fallo al resolver la UF (proveedor o tabla) nunca interrumpe la consulta
  // principal: los equivalentes afectados quedan en null.
  async function resolverUf(periodos: string[]): Promise<Map<string, ValorUfDto>> {
    if (!uf) return new Map();
    try {
      return await uf.obtenerValores(periodos);
    } catch (error) {
      console.error("No se pudo resolver la UF para los equivalentes del crédito", error);
      return new Map();
    }
  }

  return {
    obtenerPorPropiedad,

    // `hoy` (YYYY-MM-DD) se inyecta para poder probar; por defecto hoyChile().
    async obtenerConEquivalentes(
      propiedadId: string,
      hoy: string = hoyChile()
    ): Promise<CreditoConEquivalentesDto> {
      const credito = await obtenerPorPropiedad(propiedadId);
      const ultimo = await registros.ultimoSaldoRegistrado(propiedadId);

      const periodoActual = hoy.slice(0, 7);
      // Sin fechaOtorgamiento no se inventa referencia: el equivalente es null.
      const periodoOtorgamiento =
        credito.saldoInicialUf !== null && credito.fechaOtorgamiento !== null
          ? credito.fechaOtorgamiento.slice(0, 7)
          : null;

      const periodos = [periodoActual];
      if (periodoOtorgamiento) periodos.push(periodoOtorgamiento);
      if (ultimo) periodos.push(ultimo.periodo);
      const valores = await resolverUf(periodos);

      // El pie se estima sobre el valor de compra registrado, en su moneda original.
      const propiedad =
        credito.porcentajePie === null
          ? null
          : await prisma.propiedad.findUnique({
              where: { id: propiedadId },
              select: { valorCompraMonto: true, valorCompraMoneda: true },
            });

      return {
        ...credito,
        pieEstimado: propiedad
          ? calcularPieEstimado(
              propiedad.valorCompraMonto.toString(),
              propiedad.valorCompraMoneda,
              credito.porcentajePie
            )
          : null,
        cuotaContractualClp: calcularEquivalenteClp(
          credito.cuotaContractualUf,
          valores.get(periodoActual)
        ),
        saldoInicialClp: periodoOtorgamiento
          ? calcularEquivalenteClp(credito.saldoInicialUf, valores.get(periodoOtorgamiento))
          : null,
        ultimoSaldo: ultimo
          ? {
              ...ultimo,
              equivalenteClp: calcularEquivalenteClp(
                ultimo.saldoPendienteUf,
                valores.get(ultimo.periodo)
              ),
            }
          : null,
      };
    },

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
