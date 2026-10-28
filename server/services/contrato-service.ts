import type { ContratoArriendo, ContratoMonto, Prisma, PrismaClient, Arrendatario } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import { type Vigencia, vigenciaDe } from "@/server/domain/contrato-vigencia";
import type {
  ContratoActualizarInput,
  ContratoCrearInput,
} from "@/server/schemas/contrato";
import {
  type ArrendatarioDto,
  RUT_DUPLICADO,
  asegurarArrendatario,
  esRutDuplicado,
  toArrendatarioDto,
} from "./arrendatario-service";
import { asegurarPropiedad } from "./propiedad-lookup";

export type ContratoDto = {
  id: string;
  propiedadId: string;
  arrendatario: ArrendatarioDto;
  fechaInicio: string;
  fechaTermino: string;
  // Solo información contractual: no es ingreso ni se vincula a movimientos.
  garantiaClp: string | null;
  diaEsperadoPago: number;
  observaciones: string | null;
  // Fila inicial de contrato_monto (T04) o null si el contrato no la tiene.
  // No es un «monto vigente»: ese cálculo es de T05.
  montoInicialClp: string | null;
  vigencia: Vigencia;
  createdAt: string;
  updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_CONTRATO = "Contrato no encontrado";

const include = {
  arrendatario: true,
  montos: { orderBy: { vigenteDesdePeriodo: "asc" }, take: 1 },
} satisfies Prisma.ContratoArriendoInclude;

type ContratoConRelaciones = ContratoArriendo & {
  arrendatario: Arrendatario;
  montos: ContratoMonto[];
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fechaADate = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);
// Mes de una fecha YYYY-MM-DD como día 1 (periodo de contrato_monto).
const primerDiaDelMes = (fecha: string) => new Date(`${fecha.slice(0, 7)}-01T00:00:00.000Z`);

// Decimal → texto: nunca pasa por Number.
function toDto(c: ContratoConRelaciones, referencia: string): ContratoDto {
  const fechaInicio = isoDate(c.fechaInicio);
  const fechaTermino = isoDate(c.fechaTermino);
  return {
    id: c.id,
    propiedadId: c.propiedadId,
    arrendatario: toArrendatarioDto(c.arrendatario),
    fechaInicio,
    fechaTermino,
    garantiaClp: c.garantiaClp?.toString() ?? null,
    diaEsperadoPago: c.diaEsperadoPago,
    observaciones: c.observaciones,
    montoInicialClp: c.montos[0]?.montoMensualClp.toString() ?? null,
    vigencia: vigenciaDe({ fechaInicio, fechaTermino }, referencia),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function createContratoService(prisma: PrismaClient) {
  // Serializa las altas y ediciones de una misma propiedad: el bloqueo
  // transaccional se toma antes de comprobar el solape y se libera al terminar
  // la transacción. POST y PUT usan este mismo helper.
  function conBloqueoDePropiedad<T>(
    propiedadId: string,
    operacion: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${propiedadId}))`;
      return operacion(tx);
    });
  }

  // Extremos inclusivos: se solapan si inicioA <= terminoB y inicioB <= terminoA.
  async function verificarSinSolape(
    tx: Prisma.TransactionClient,
    propiedadId: string,
    fechaInicio: string,
    fechaTermino: string,
    excluirContratoId?: string
  ): Promise<void> {
    const otro = await tx.contratoArriendo.findFirst({
      where: {
        propiedadId,
        ...(excluirContratoId ? { id: { not: excluirContratoId } } : {}),
        fechaInicio: { lte: fechaADate(fechaTermino) },
        fechaTermino: { gte: fechaADate(fechaInicio) },
      },
      select: { id: true },
    });
    if (otro) {
      throw new ConflictError("El contrato se solapa con otro contrato de la propiedad");
    }
  }

  async function obtenerFila(
    client: Prisma.TransactionClient,
    propiedadId: string,
    contratoId: string
  ): Promise<ContratoConRelaciones> {
    if (!UUID.test(contratoId)) throw new NotFoundError(SIN_CONTRATO);
    const fila = await client.contratoArriendo.findFirst({
      where: { id: contratoId, propiedadId },
      include,
    });
    if (!fila) throw new NotFoundError(SIN_CONTRATO);
    return fila;
  }

  return {
    // Del contrato más reciente al más antiguo; sin paginación.
    async listar(propiedadId: string, referencia: string): Promise<ContratoDto[]> {
      await asegurarPropiedad(prisma, propiedadId);
      const filas = await prisma.contratoArriendo.findMany({
        where: { propiedadId },
        include,
        orderBy: { fechaInicio: "desc" },
      });
      return filas.map((f) => toDto(f, referencia));
    },

    async obtener(
      propiedadId: string,
      contratoId: string,
      referencia: string
    ): Promise<ContratoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      return toDto(await obtenerFila(prisma, propiedadId, contratoId), referencia);
    },

    async crear(
      propiedadId: string,
      input: ContratoCrearInput,
      referencia: string
    ): Promise<ContratoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      try {
        return await conBloqueoDePropiedad(propiedadId, async (tx) => {
          let arrendatarioId: string;
          if (input.arrendatarioId) {
            await asegurarArrendatario(tx, input.arrendatarioId);
            arrendatarioId = input.arrendatarioId;
          } else if (input.arrendatario) {
            arrendatarioId = (await tx.arrendatario.create({ data: input.arrendatario })).id;
          } else {
            throw new NotFoundError("Arrendatario no encontrado");
          }

          await verificarSinSolape(tx, propiedadId, input.fechaInicio, input.fechaTermino);

          const contrato = await tx.contratoArriendo.create({
            data: {
              propiedadId,
              arrendatarioId,
              fechaInicio: fechaADate(input.fechaInicio),
              fechaTermino: fechaADate(input.fechaTermino),
              garantiaClp: input.garantiaClp,
              diaEsperadoPago: input.diaEsperadoPago,
              observaciones: input.observaciones,
            },
          });
          // Monto inicial opcional: única fila de contrato_monto que crea T04.
          if (input.montoMensualClp) {
            await tx.contratoMonto.create({
              data: {
                contratoId: contrato.id,
                montoMensualClp: input.montoMensualClp,
                vigenteDesdePeriodo: primerDiaDelMes(input.fechaInicio),
                motivo: "monto inicial",
              },
            });
          }
          return toDto(await obtenerFila(tx, propiedadId, contrato.id), referencia);
        });
      } catch (error) {
        // Solo el arrendatario anidado puede violar un UNIQUE (RUT).
        if (esRutDuplicado(error)) throw new ConflictError(RUT_DUPLICADO);
        throw error;
      }
    },

    // Solo actualiza un contrato existente; nunca lo crea ni toca contrato_monto.
    async actualizar(
      propiedadId: string,
      contratoId: string,
      input: ContratoActualizarInput,
      referencia: string
    ): Promise<ContratoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      return conBloqueoDePropiedad(propiedadId, async (tx) => {
        const actual = await obtenerFila(tx, propiedadId, contratoId);
        await asegurarArrendatario(tx, input.arrendatarioId);

        // El monto inicial debe seguir rigiendo desde el mes de inicio
        // (data-model §5.1, regla 4) y no se sobrescribe: cambiar el mes de
        // fechaInicio queda bloqueado mientras exista esa fila.
        const montoInicial = actual.montos[0];
        if (
          montoInicial &&
          isoDate(montoInicial.vigenteDesdePeriodo).slice(0, 7) !== input.fechaInicio.slice(0, 7)
        ) {
          throw new ConflictError(
            "No se puede cambiar el mes de inicio de un contrato con monto inicial registrado"
          );
        }

        await verificarSinSolape(tx, propiedadId, input.fechaInicio, input.fechaTermino, contratoId);

        await tx.contratoArriendo.update({
          where: { id: contratoId },
          data: {
            arrendatarioId: input.arrendatarioId,
            fechaInicio: fechaADate(input.fechaInicio),
            fechaTermino: fechaADate(input.fechaTermino),
            garantiaClp: input.garantiaClp,
            diaEsperadoPago: input.diaEsperadoPago,
            observaciones: input.observaciones,
          },
        });
        return toDto(await obtenerFila(tx, propiedadId, contratoId), referencia);
      });
    },
  };
}
