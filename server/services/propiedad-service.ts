import type { Propiedad, PrismaClient } from "@prisma/client";
import { NotFoundError } from "@/server/errors";
import type { PropiedadInput } from "@/server/schemas/propiedad";

export type PropiedadDto = {
  id: string;
  numeroDepartamento: string;
  direccion: string | null;
  superficieM2: string;
  valorCompraMonto: string;
  valorCompraMoneda: "UF" | "CLP";
  fechaCompra: string;
  estacionamiento: string | null;
  bodega: string | null;
  createdAt: string;
  updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDto(p: Propiedad): PropiedadDto {
  return {
    id: p.id,
    numeroDepartamento: p.numeroDepartamento,
    direccion: p.direccion,
    superficieM2: p.superficieM2.toString(),
    valorCompraMonto: p.valorCompraMonto.toString(),
    valorCompraMoneda: p.valorCompraMoneda,
    fechaCompra: p.fechaCompra.toISOString().slice(0, 10),
    estacionamiento: p.estacionamiento,
    bodega: p.bodega,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function toData(input: PropiedadInput) {
  return { ...input, fechaCompra: new Date(`${input.fechaCompra}T00:00:00.000Z`) };
}

// El cliente Prisma se inyecta para poder probar contra una BD de pruebas
// independiente sin tocar la de desarrollo.
export function createPropiedadService(prisma: PrismaClient) {
  async function obtener(id: string): Promise<PropiedadDto> {
    if (!UUID.test(id)) throw new NotFoundError("Propiedad no encontrada");
    const row = await prisma.propiedad.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("Propiedad no encontrada");
    return toDto(row);
  }

  return {
    obtener,

    async listar(): Promise<PropiedadDto[]> {
      const rows = await prisma.propiedad.findMany({
        orderBy: [{ createdAt: "asc" }, { numeroDepartamento: "asc" }],
      });
      return rows.map(toDto);
    },

    async crear(input: PropiedadInput): Promise<PropiedadDto> {
      return toDto(await prisma.propiedad.create({ data: toData(input) }));
    },

    async actualizar(id: string, input: PropiedadInput): Promise<PropiedadDto> {
      if (!UUID.test(id)) throw new NotFoundError("Propiedad no encontrada");
      const { count } = await prisma.propiedad.updateMany({
        where: { id },
        data: toData(input),
      });
      if (count === 0) throw new NotFoundError("Propiedad no encontrada");
      return obtener(id);
    },
  };
}
