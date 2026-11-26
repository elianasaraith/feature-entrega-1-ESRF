import type { MovimientoConcepto, Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { NotFoundError, UnprocessableError } from "@/server/errors";
import {
  type CategoriaMovimiento,
  type ResumenMovimientos,
  agregarPorCategoria,
  rangoDelMes,
} from "@/server/domain/movimiento-agregacion";
import { sumarConceptos } from "@/server/domain/movimiento-desglose";
import type { ConceptoInput, MovimientoEdicionInput, MovimientoInput } from "@/server/schemas/movimiento";
import { asegurarPropiedad } from "./propiedad-lookup";

export type ConceptoDto = {
  id: string;
  nombre: string;
  montoClp: string;
  orden: number;
};

// `conceptos` es la única adición respecto de T07: lista vacía en un gasto simple.
export type MovimientoDto = {
  id: string;
  propiedadId: string;
  fecha: string;
  categoria: CategoriaMovimiento;
  montoClp: string;
  descripcion: string | null;
  conceptos: ConceptoDto[];
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
const MAX_DIGITOS_TOTAL = 14; // NUMERIC(14,0)

// Conceptos siempre en el orden en que se registraron.
const CON_CONCEPTOS = { conceptos: { orderBy: { orden: "asc" } } } satisfies Prisma.MovimientoFinancieroInclude;
type MovimientoConConceptos = Prisma.MovimientoFinancieroGetPayload<{ include: typeof CON_CONCEPTOS }>;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fechaADate = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

function toConceptoDto(c: MovimientoConcepto): ConceptoDto {
  return { id: c.id, nombre: c.nombre, montoClp: c.montoClp.toString(), orden: c.orden };
}

// Decimal → texto: nunca pasa por Number.
function toDto(m: MovimientoConConceptos): MovimientoDto {
  return {
    id: m.id,
    propiedadId: m.propiedadId,
    fecha: isoDate(m.fecha),
    categoria: m.categoria,
    montoClp: m.montoClp.toString(),
    descripcion: m.descripcion,
    conceptos: m.conceptos.map(toConceptoDto),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// Error de FORMATO que solo el estado del registro revela (→ 400): un gasto
// simple sin monto. Es el mismo 400 con `campos.montoClp` que da el esquema.
function montoRequerido(): ZodError {
  return new ZodError([
    { code: "custom", path: ["montoClp"], message: "El monto es obligatorio", input: undefined },
  ]);
}

// Reglas de negocio (→ 422). El formato ya lo validó el esquema Zod (→ 400).
function validarFecha(fecha: string, hoy: string): void {
  if (fecha > hoy) throw new UnprocessableError("La fecha no puede ser futura");
}

function validarMontoSimple(montoClp: string | undefined): string {
  if (montoClp === undefined) throw montoRequerido();
  if (BigInt(montoClp) <= ZERO) throw new UnprocessableError("El monto debe ser mayor que 0");
  return BigInt(montoClp).toString();
}

// Total de un desglose, calculado en el backend con bigint. Si el cliente envía
// `montoClp`, debe coincidir con la suma.
function totalDeConceptos(conceptos: ConceptoInput[], montoClp: string | undefined): string {
  for (const c of conceptos) {
    if (BigInt(c.montoClp) <= ZERO) {
      throw new UnprocessableError("El monto de cada concepto debe ser mayor que 0");
    }
  }
  const total = sumarConceptos(conceptos.map((c) => BigInt(c.montoClp).toString()));
  if (total.length > MAX_DIGITOS_TOTAL) {
    throw new UnprocessableError("El total del desglose excede el rango permitido");
  }
  if (montoClp !== undefined && BigInt(montoClp) !== BigInt(total)) {
    throw new UnprocessableError("El monto total no coincide con la suma de los conceptos");
  }
  return total;
}

// `orden` es la posición (0..n−1) en la lista recibida.
const filasDeConceptos = (conceptos: ConceptoInput[]) =>
  conceptos.map((c, orden) => ({ nombre: c.nombre, montoClp: BigInt(c.montoClp).toString(), orden }));

export function createMovimientoService(prisma: PrismaClient) {
  async function asegurarMovimiento(
    propiedadId: string,
    movimientoId: string
  ): Promise<MovimientoConConceptos> {
    await asegurarPropiedad(prisma, propiedadId);
    if (!UUID.test(movimientoId)) throw new NotFoundError(SIN_MOVIMIENTO);
    const fila = await prisma.movimientoFinanciero.findFirst({
      where: { id: movimientoId, propiedadId },
      include: CON_CONCEPTOS,
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
      include: CON_CONCEPTOS,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });
  }

  // Reemplaza el desglose completo (o lo elimina con una lista vacía) y actualiza
  // el movimiento en una sola transacción: o se aplica todo o no cambia nada. El
  // borrado explícito va primero para no depender del orden de las escrituras
  // anidadas. Las validaciones ya corrieron: aquí no se decide nada de negocio.
  function reemplazarDesglose(
    movimientoId: string,
    input: MovimientoEdicionInput,
    montoClp: string,
    conceptos: ConceptoInput[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.movimientoConcepto.deleteMany({ where: { movimientoFinancieroId: movimientoId } });
      return tx.movimientoFinanciero.update({
        where: { id: movimientoId },
        data: {
          fecha: fechaADate(input.fecha),
          categoria: input.categoria,
          montoClp,
          descripcion: input.descripcion,
          conceptos: { create: filasDeConceptos(conceptos) },
        },
        include: CON_CONCEPTOS,
      });
    });
  }

  return {
    // Sin `mes` cubre el historial completo; con `mes`, solo ese mes calendario.
    // Los totales usan el `montoClp` de cada movimiento (el total del gasto), nunca
    // la suma de sus conceptos: un gasto desglosado se cuenta una sola vez.
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

    // Simple (sin `conceptos` o `[]`, con `montoClp`) o desglosado (total = suma).
    async crear(propiedadId: string, input: MovimientoInput, hoy: string): Promise<MovimientoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      const conceptos = input.conceptos ?? [];
      const montoClp =
        conceptos.length > 0 ? totalDeConceptos(conceptos, input.montoClp) : validarMontoSimple(input.montoClp);
      validarFecha(input.fecha, hoy);
      return toDto(
        await prisma.movimientoFinanciero.create({
          data: {
            propiedadId,
            fecha: fechaADate(input.fecha),
            categoria: input.categoria,
            montoClp,
            descripcion: input.descripcion,
            ...(conceptos.length > 0 ? { conceptos: { create: filasDeConceptos(conceptos) } } : {}),
          },
          include: CON_CONCEPTOS,
        })
      );
    },

    // El campo `conceptos` decide el destino del desglose (design.md D7):
    //  - ausente   → no lo toca. Simple: edición normal (monto obligatorio).
    //                Desglosado: conserva conceptos y total; `montoClp` omitido o
    //                igual al total, y distinto → 422 sin modificar nada.
    //  - []        → convierte a simple (exige monto > 0) y elimina los conceptos.
    //  - con items → reemplaza el desglose; el total lo calcula el backend.
    // Todas las validaciones corren antes de escribir.
    async editar(
      propiedadId: string,
      movimientoId: string,
      input: MovimientoEdicionInput,
      hoy: string
    ): Promise<MovimientoDto> {
      const actual = await asegurarMovimiento(propiedadId, movimientoId);

      if (input.conceptos === undefined) {
        if (actual.conceptos.length > 0) {
          if (input.montoClp !== undefined && BigInt(input.montoClp) !== BigInt(actual.montoClp.toString())) {
            throw new UnprocessableError(
              "El monto no coincide con el total del desglose: envíe `conceptos` para reemplazarlo o `conceptos: []` para convertirlo en gasto simple"
            );
          }
          validarFecha(input.fecha, hoy);
          return toDto(
            await prisma.movimientoFinanciero.update({
              where: { id: movimientoId },
              data: {
                fecha: fechaADate(input.fecha),
                categoria: input.categoria,
                descripcion: input.descripcion,
              },
              include: CON_CONCEPTOS,
            })
          );
        }
        const montoClp = validarMontoSimple(input.montoClp);
        validarFecha(input.fecha, hoy);
        return toDto(
          await prisma.movimientoFinanciero.update({
            where: { id: movimientoId },
            data: {
              fecha: fechaADate(input.fecha),
              categoria: input.categoria,
              montoClp,
              descripcion: input.descripcion,
            },
            include: CON_CONCEPTOS,
          })
        );
      }

      if (input.conceptos.length === 0) {
        const montoClp = validarMontoSimple(input.montoClp);
        validarFecha(input.fecha, hoy);
        return toDto(await reemplazarDesglose(movimientoId, input, montoClp, []));
      }

      const montoClp = totalDeConceptos(input.conceptos, input.montoClp);
      validarFecha(input.fecha, hoy);
      return toDto(await reemplazarDesglose(movimientoId, input, montoClp, input.conceptos));
    },

    // Borrado físico, sin auditoría. ON DELETE CASCADE elimina sus conceptos.
    async eliminar(propiedadId: string, movimientoId: string): Promise<void> {
      await asegurarMovimiento(propiedadId, movimientoId);
      await prisma.movimientoFinanciero.delete({ where: { id: movimientoId } });
    },
  };
}
