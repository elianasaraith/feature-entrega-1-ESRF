import { Prisma } from "@prisma/client";
import type { Arrendatario, PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/errors";
import type { ArrendatarioInput } from "@/server/schemas/arrendatario";

export type ArrendatarioDto = {
  id: string;
  nombre: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIN_ARRENDATARIO = "Arrendatario no encontrado";
export const RUT_DUPLICADO = "Ya existe un arrendatario con ese RUT";

export function toArrendatarioDto(a: Arrendatario): ArrendatarioDto {
  return { id: a.id, nombre: a.nombre, rut: a.rut, email: a.email, telefono: a.telefono };
}

// Un id que no es UUID o que no existe se trata igual: 404. Acepta el cliente o
// una transacción. El MVP es de usuario único (sin usuario_id): la garantía de
// acceso es la sesión exigida en el handler; aquí solo se comprueba existencia.
export async function asegurarArrendatario(
  prisma: Prisma.TransactionClient,
  arrendatarioId: string
): Promise<void> {
  if (!UUID.test(arrendatarioId)) throw new NotFoundError(SIN_ARRENDATARIO);
  const arrendatario = await prisma.arrendatario.findUnique({
    where: { id: arrendatarioId },
    select: { id: true },
  });
  if (!arrendatario) throw new NotFoundError(SIN_ARRENDATARIO);
}

export function esRutDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createArrendatarioService(prisma: PrismaClient) {
  return {
    async listar(): Promise<ArrendatarioDto[]> {
      const filas = await prisma.arrendatario.findMany({
        orderBy: [{ nombre: "asc" }, { createdAt: "asc" }],
      });
      return filas.map(toArrendatarioDto);
    },

    async crear(input: ArrendatarioInput): Promise<ArrendatarioDto> {
      try {
        return toArrendatarioDto(await prisma.arrendatario.create({ data: input }));
      } catch (error) {
        if (esRutDuplicado(error)) throw new ConflictError(RUT_DUPLICADO);
        throw error;
      }
    },
  };
}
