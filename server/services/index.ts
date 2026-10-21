import "server-only";
import { prisma } from "@/server/db/client";
import { createPropiedadService } from "./propiedad-service";

export const propiedadService = createPropiedadService(prisma);
