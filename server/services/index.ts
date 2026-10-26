import "server-only";
import { prisma } from "@/server/db/client";
import { createCreditoService } from "./credito-service";
import { createPropiedadService } from "./propiedad-service";

export const propiedadService = createPropiedadService(prisma);
export const creditoService = createCreditoService(prisma);
