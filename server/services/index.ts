import "server-only";
import { prisma } from "@/server/db/client";
import { createArrendatarioService } from "./arrendatario-service";
import { createContratoService } from "./contrato-service";
import { createDashboardService } from "./dashboard-service";
import { createCreditoService } from "./credito-service";
import { createCreditoRegistroService } from "./credito-registro-service";
import { createMovimientoService } from "./movimiento-service";
import { createPagoService } from "./pago-service";
import { createPropiedadService } from "./propiedad-service";

export const propiedadService = createPropiedadService(prisma);
export const creditoService = createCreditoService(prisma);
export const creditoRegistroService = createCreditoRegistroService(prisma);
export const arrendatarioService = createArrendatarioService(prisma);
export const contratoService = createContratoService(prisma);
export const pagoService = createPagoService(prisma);
export const movimientoService = createMovimientoService(prisma);
export const dashboardService = createDashboardService(prisma);
