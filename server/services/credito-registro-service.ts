import { Prisma } from "@prisma/client";
import type { CreditoRegistroMensual, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import type {
  RegistroMensualActualizarInput,
  RegistroMensualCrearInput,
} from "@/server/schemas/credito-registro";
import { SIN_CREDITO, asegurarPropiedad } from "./propiedad-lookup";

// `periodo` viaja como YYYY-MM y se guarda como el día 1 del mes. Un mes sin
// fila se representa con registrado=false y valores null: nunca se estima ni
// se arrastra el valor de otro mes (HU01 CL11, CL12).
export type RegistroMensualDto = {
  periodo: string;
  registrado: boolean;
  dividendoPagadoClp: string | null;
  fechaPagoDividendo: string | null;
  saldoPendienteUf: string | null;
};

export type UltimoSaldoDto = { periodo: string; saldoPendienteUf: string };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function periodoADate(periodo: string): Date {
  return new Date(`${periodo}-01T00:00:00.000Z`);
}

function fechaADate(fecha: string | null): Date | null {
  return fecha ? new Date(`${fecha}T00:00:00.000Z`) : null;
}

// Decimal → texto: nunca pasa por Number.
function toDto(r: CreditoRegistroMensual): RegistroMensualDto {
  return {
    periodo: isoDate(r.periodo).slice(0, 7),
    registrado: true,
    dividendoPagadoClp: r.dividendoPagadoClp?.toString() ?? null,
    fechaPagoDividendo: r.fechaPagoDividendo ? isoDate(r.fechaPagoDividendo) : null,
    saldoPendienteUf: r.saldoPendienteUf?.toString() ?? null,
  };
}

function sinRegistro(periodo: string): RegistroMensualDto {
  return {
    periodo,
    registrado: false,
    dividendoPagadoClp: null,
    fechaPagoDividendo: null,
    saldoPendienteUf: null,
  };
}

function isKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function createCreditoRegistroService(prisma: PrismaClient) {
  // El crédito se resuelve desde la propiedad (relación 1 : 0..1).
  async function creditoIdDe(propiedadId: string): Promise<string> {
    await asegurarPropiedad(prisma, propiedadId);
    const credito = await prisma.creditoHipotecario.findUnique({
      where: { propiedadId },
      select: { id: true },
    });
    if (!credito) throw new NotFoundError(SIN_CREDITO);
    return credito.id;
  }

  return {
    // Del período más reciente al más antiguo; sin paginación.
    async listar(propiedadId: string): Promise<RegistroMensualDto[]> {
      const creditoId = await creditoIdDe(propiedadId);
      const filas = await prisma.creditoRegistroMensual.findMany({
        where: { creditoId },
        orderBy: { periodo: "desc" },
      });
      return filas.map(toDto);
    },

    async obtenerPorPeriodo(propiedadId: string, periodo: string): Promise<RegistroMensualDto> {
      const creditoId = await creditoIdDe(propiedadId);
      const fila = await prisma.creditoRegistroMensual.findUnique({
        where: { creditoId_periodo: { creditoId, periodo: periodoADate(periodo) } },
      });
      return fila ? toDto(fila) : sinRegistro(periodo);
    },

    async crear(
      propiedadId: string,
      input: RegistroMensualCrearInput
    ): Promise<RegistroMensualDto> {
      const creditoId = await creditoIdDe(propiedadId);
      try {
        return toDto(
          await prisma.creditoRegistroMensual.create({
            data: {
              creditoId,
              periodo: periodoADate(input.periodo),
              dividendoPagadoClp: input.dividendoPagadoClp,
              fechaPagoDividendo: fechaADate(input.fechaPagoDividendo),
              saldoPendienteUf: input.saldoPendienteUf,
            },
          })
        );
      } catch (error) {
        // UNIQUE(credito_id, periodo): también cubre la carrera entre dos POST.
        if (isKnownError(error, "P2002")) {
          throw new ConflictError("El crédito ya tiene un registro para ese período");
        }
        throw error;
      }
    },

    // Solo actualiza un registro existente; nunca lo crea.
    async actualizar(
      propiedadId: string,
      periodo: string,
      input: RegistroMensualActualizarInput
    ): Promise<RegistroMensualDto> {
      const creditoId = await creditoIdDe(propiedadId);
      const { count } = await prisma.creditoRegistroMensual.updateMany({
        where: { creditoId, periodo: periodoADate(periodo) },
        data: {
          dividendoPagadoClp: input.dividendoPagadoClp,
          fechaPagoDividendo: fechaADate(input.fechaPagoDividendo),
          saldoPendienteUf: input.saldoPendienteUf,
        },
      });
      if (count === 0) throw new NotFoundError("No existe un registro para ese período");
      return this.obtenerPorPeriodo(propiedadId, periodo);
    },

    // Registro de período máximo con saldo no nulo. No calcula ni proyecta.
    async ultimoSaldoRegistrado(propiedadId: string): Promise<UltimoSaldoDto | null> {
      const creditoId = await creditoIdDe(propiedadId);
      const fila = await prisma.creditoRegistroMensual.findFirst({
        where: { creditoId, saldoPendienteUf: { not: null } },
        orderBy: { periodo: "desc" },
      });
      if (!fila || fila.saldoPendienteUf === null) return null;
      return {
        periodo: isoDate(fila.periodo).slice(0, 7),
        saldoPendienteUf: fila.saldoPendienteUf.toString(),
      };
    },
  };
}
