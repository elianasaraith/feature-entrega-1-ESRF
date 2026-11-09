import type { AbonoArriendo, PagoEsperado, Prisma, PrismaClient } from "@prisma/client";
import { NotFoundError, UnprocessableError } from "@/server/errors";
import { type EstadoPagoCalculado, calcularEstadoPago, ordenarAbonos } from "@/server/domain/pago-estado";
import type { AbonoInput } from "@/server/schemas/abono";
import { asegurarPropiedad } from "./propiedad-lookup";

export type AbonoDto = {
  id: string;
  pagoEsperadoId: string;
  montoClp: string;
  fechaRecepcion: string;
  medio: string | null;
  createdAt: string;
  updatedAt: string;
};

// Pago esperado con su estado DERIVADO a la fecha de referencia: nada de lo
// calculado se persiste (docs/data-model.md §6.1).
export type PagoDto = EstadoPagoCalculado & {
  id: string;
  contratoId: string;
  periodo: string;
  montoEsperadoClp: string;
  fechaEsperada: string;
  abonos: AbonoDto[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_CONTRATO = "Contrato no encontrado";
const SIN_PAGO = "Pago esperado no encontrado";
const SIN_ABONO = "Abono no encontrado";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fechaADate = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

function toAbonoDto(a: AbonoArriendo): AbonoDto {
  return {
    id: a.id,
    pagoEsperadoId: a.pagoEsperadoId,
    montoClp: a.montoClp.toString(),
    fechaRecepcion: isoDate(a.fechaRecepcion),
    medio: a.medio,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function toPagoDto(p: PagoEsperado & { abonos: AbonoArriendo[] }, hoy: string): PagoDto {
  const abonos = ordenarAbonos(p.abonos.map(toAbonoDto));
  const montoEsperadoClp = p.montoEsperadoClp.toString();
  const fechaEsperada = isoDate(p.fechaEsperada);
  return {
    id: p.id,
    contratoId: p.contratoId,
    periodo: isoDate(p.periodo),
    montoEsperadoClp,
    fechaEsperada,
    abonos,
    ...calcularEstadoPago({ montoEsperadoClp, fechaEsperada, abonos }, hoy),
  };
}

const ZERO = BigInt(0);

// Reglas de negocio del abono (→ 422), comunes a alta y edición. El formato ya
// lo validó el esquema Zod (→ 400).
function validarAbono(input: AbonoInput, hoy: string): void {
  if (BigInt(input.montoClp) <= ZERO) {
    throw new UnprocessableError("El monto debe ser mayor que 0");
  }
  if (input.fechaRecepcion > hoy) {
    throw new UnprocessableError("La fecha de recepción no puede ser futura");
  }
}

export function createPagoService(prisma: PrismaClient) {
  // Mismo bloqueo por propiedad que T04/T05: serializa altas, ediciones y bajas.
  function conBloqueoDePropiedad<T>(
    propiedadId: string,
    operacion: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${propiedadId}))`;
      return operacion(tx);
    });
  }

  // Cadena de pertenencia propiedad → contrato → pago esperado. Cualquier id que
  // no coincida (o que no sea UUID) es 404 y no se lee ni modifica nada más.
  async function asegurarPago(
    client: Prisma.TransactionClient | PrismaClient,
    propiedadId: string,
    contratoId: string,
    pagoId: string
  ): Promise<PagoEsperado> {
    if (!UUID.test(contratoId)) throw new NotFoundError(SIN_CONTRATO);
    const contrato = await client.contratoArriendo.findFirst({
      where: { id: contratoId, propiedadId },
      select: { id: true },
    });
    if (!contrato) throw new NotFoundError(SIN_CONTRATO);
    if (!UUID.test(pagoId)) throw new NotFoundError(SIN_PAGO);
    const pago = await client.pagoEsperado.findFirst({ where: { id: pagoId, contratoId } });
    if (!pago) throw new NotFoundError(SIN_PAGO);
    return pago;
  }

  async function asegurarAbono(
    tx: Prisma.TransactionClient,
    pagoId: string,
    abonoId: string
  ): Promise<AbonoArriendo> {
    if (!UUID.test(abonoId)) throw new NotFoundError(SIN_ABONO);
    const abono = await tx.abonoArriendo.findFirst({ where: { id: abonoId, pagoEsperadoId: pagoId } });
    if (!abono) throw new NotFoundError(SIN_ABONO);
    return abono;
  }

  return {
    // Pagos esperados del contrato, por período, con su estado derivado a `hoy`.
    // Solo lectura: no crea pagos (eso es la sincronización explícita de T05).
    async listarPagos(propiedadId: string, contratoId: string, hoy: string): Promise<PagoDto[]> {
      await asegurarPropiedad(prisma, propiedadId);
      if (!UUID.test(contratoId)) throw new NotFoundError(SIN_CONTRATO);
      const contrato = await prisma.contratoArriendo.findFirst({
        where: { id: contratoId, propiedadId },
        select: { id: true },
      });
      if (!contrato) throw new NotFoundError(SIN_CONTRATO);
      const pagos = await prisma.pagoEsperado.findMany({
        where: { contratoId },
        include: { abonos: true },
        orderBy: { periodo: "asc" },
      });
      return pagos.map((p) => toPagoDto(p, hoy));
    },

    // Por fecha de recepción, luego created_at e id.
    async listarAbonos(propiedadId: string, contratoId: string, pagoId: string): Promise<AbonoDto[]> {
      await asegurarPropiedad(prisma, propiedadId);
      await asegurarPago(prisma, propiedadId, contratoId, pagoId);
      const abonos = await prisma.abonoArriendo.findMany({ where: { pagoEsperadoId: pagoId } });
      return ordenarAbonos(abonos.map(toAbonoDto));
    },

    async crearAbono(
      propiedadId: string,
      contratoId: string,
      pagoId: string,
      input: AbonoInput,
      hoy: string
    ): Promise<AbonoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      return conBloqueoDePropiedad(propiedadId, async (tx) => {
        await asegurarPago(tx, propiedadId, contratoId, pagoId);
        validarAbono(input, hoy);
        const creado = await tx.abonoArriendo.create({
          data: {
            pagoEsperadoId: pagoId,
            montoClp: input.montoClp,
            fechaRecepcion: fechaADate(input.fechaRecepcion),
            medio: input.medio,
          },
        });
        return toAbonoDto(creado);
      });
    },

    // Reemplaza monto, fecha y medio; el pago al que pertenece no cambia.
    async editarAbono(
      propiedadId: string,
      contratoId: string,
      pagoId: string,
      abonoId: string,
      input: AbonoInput,
      hoy: string
    ): Promise<AbonoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      return conBloqueoDePropiedad(propiedadId, async (tx) => {
        await asegurarPago(tx, propiedadId, contratoId, pagoId);
        await asegurarAbono(tx, pagoId, abonoId);
        validarAbono(input, hoy);
        const actualizado = await tx.abonoArriendo.update({
          where: { id: abonoId },
          data: {
            montoClp: input.montoClp,
            fechaRecepcion: fechaADate(input.fechaRecepcion),
            medio: input.medio,
          },
        });
        return toAbonoDto(actualizado);
      });
    },

    // Borrado físico (docs/data-model.md: sin papelera ni auditoría en el MVP).
    async eliminarAbono(
      propiedadId: string,
      contratoId: string,
      pagoId: string,
      abonoId: string
    ): Promise<void> {
      await asegurarPropiedad(prisma, propiedadId);
      await conBloqueoDePropiedad(propiedadId, async (tx) => {
        await asegurarPago(tx, propiedadId, contratoId, pagoId);
        await asegurarAbono(tx, pagoId, abonoId);
        await tx.abonoArriendo.delete({ where: { id: abonoId } });
      });
    },
  };
}
