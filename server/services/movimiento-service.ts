import type { MovimientoFinanciero, PrismaClient } from "@prisma/client";
import { NotFoundError, UnprocessableError } from "@/server/errors";
import {
  type CategoriaMovimiento,
  type ResumenMovimientos,
  agregarPorCategoria,
  rangoDelMes,
} from "@/server/domain/movimiento-agregacion";
import type { MovimientoInput } from "@/server/schemas/movimiento";
import { asegurarPropiedad } from "./propiedad-lookup";

export type MovimientoDto = {
  id: string;
  propiedadId: string;
  fecha: string;
  categoria: CategoriaMovimiento;
  montoClp: string;
  descripcion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MovimientosListadoDto = ResumenMovimientos & {
  mes: string | null;
  movimientos: MovimientoDto[];
};

export type ResumenMensualDto = ResumenMovimientos & { mes: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_MOVIMIENTO = "Movimiento no encontrado";
const ZERO = BigInt(0);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fechaADate = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

// Decimal → texto: nunca pasa por Number.
function toDto(m: MovimientoFinanciero): MovimientoDto {
  return {
    id: m.id,
    propiedadId: m.propiedadId,
    fecha: isoDate(m.fecha),
    categoria: m.categoria,
    montoClp: m.montoClp.toString(),
    descripcion: m.descripcion,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// Reglas de negocio (→ 422), comunes a alta y edición. El formato ya lo validó
// el esquema Zod (→ 400). La fecha de hoy se acepta.
function validarMovimiento(input: MovimientoInput, hoy: string): void {
  if (BigInt(input.montoClp) <= ZERO) {
    throw new UnprocessableError("El monto debe ser mayor que 0");
  }
  if (input.fecha > hoy) {
    throw new UnprocessableError("La fecha no puede ser futura");
  }
}

export function createMovimientoService(prisma: PrismaClient) {
  async function asegurarMovimiento(
    propiedadId: string,
    movimientoId: string
  ): Promise<MovimientoFinanciero> {
    await asegurarPropiedad(prisma, propiedadId);
    if (!UUID.test(movimientoId)) throw new NotFoundError(SIN_MOVIMIENTO);
    const fila = await prisma.movimientoFinanciero.findFirst({
      where: { id: movimientoId, propiedadId },
    });
    if (!fila) throw new NotFoundError(SIN_MOVIMIENTO);
    return fila;
  }

  async function filas(propiedadId: string, mes?: string | null) {
    const where = mes
      ? (() => {
          const { desde, hasta } = rangoDelMes(mes);
          return { propiedadId, fecha: { gte: fechaADate(desde), lt: fechaADate(hasta) } };
        })()
      : { propiedadId };
    return prisma.movimientoFinanciero.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });
  }

  return {
    // Sin `mes` cubre el historial completo; con `mes`, solo ese mes calendario.
    async listar(propiedadId: string, opciones: { mes?: string | null } = {}): Promise<MovimientosListadoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      const mes = opciones.mes ?? null;
      const movimientos = (await filas(propiedadId, mes)).map(toDto);
      return { mes, movimientos, ...agregarPorCategoria(movimientos) };
    },

    // Punto de entrada para T09: egresos manuales del mes de caja.
    async resumenMensual(propiedadId: string, mes: string): Promise<ResumenMensualDto> {
      await asegurarPropiedad(prisma, propiedadId);
      return { mes, ...agregarPorCategoria((await filas(propiedadId, mes)).map(toDto)) };
    },

    async obtener(propiedadId: string, movimientoId: string): Promise<MovimientoDto> {
      return toDto(await asegurarMovimiento(propiedadId, movimientoId));
    },

    async crear(propiedadId: string, input: MovimientoInput, hoy: string): Promise<MovimientoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      validarMovimiento(input, hoy);
      return toDto(
        await prisma.movimientoFinanciero.create({
          data: {
            propiedadId,
            fecha: fechaADate(input.fecha),
            categoria: input.categoria,
            montoClp: input.montoClp,
            descripcion: input.descripcion,
          },
        })
      );
    },

    async editar(
      propiedadId: string,
      movimientoId: string,
      input: MovimientoInput,
      hoy: string
    ): Promise<MovimientoDto> {
      await asegurarMovimiento(propiedadId, movimientoId);
      validarMovimiento(input, hoy);
      return toDto(
        await prisma.movimientoFinanciero.update({
          where: { id: movimientoId },
          data: {
            fecha: fechaADate(input.fecha),
            categoria: input.categoria,
            montoClp: input.montoClp,
            descripcion: input.descripcion,
          },
        })
      );
    },

    // Borrado físico, sin auditoría.
    async eliminar(propiedadId: string, movimientoId: string): Promise<void> {
      await asegurarMovimiento(propiedadId, movimientoId);
      await prisma.movimientoFinanciero.delete({ where: { id: movimientoId } });
    },
  };
}
