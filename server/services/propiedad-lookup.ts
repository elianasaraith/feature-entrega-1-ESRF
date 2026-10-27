import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "@/server/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SIN_PROPIEDAD = "Propiedad no encontrada";
export const SIN_CREDITO = "La propiedad no tiene crédito hipotecario";

// Un id que no es UUID o que no existe se trata igual: 404.
export async function asegurarPropiedad(
  prisma: PrismaClient,
  propiedadId: string
): Promise<void> {
  if (!UUID.test(propiedadId)) throw new NotFoundError(SIN_PROPIEDAD);
  const propiedad = await prisma.propiedad.findUnique({
    where: { id: propiedadId },
    select: { id: true },
  });
  if (!propiedad) throw new NotFoundError(SIN_PROPIEDAD);
}
