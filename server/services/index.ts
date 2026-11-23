import "server-only";
import { prisma } from "@/server/db/client";
import { createArrendatarioService } from "./arrendatario-service";
import { createContratoService } from "./contrato-service";
import { createDocumentoService } from "./documento-service";
import { createDashboardService } from "./dashboard-service";
import { createCreditoService } from "./credito-service";
import { createCreditoRegistroService } from "./credito-registro-service";
import { createMovimientoService } from "./movimiento-service";
import { createPagoService } from "./pago-service";
import { createPropiedadService } from "./propiedad-service";
import { almacenDesdeEntorno } from "@/server/storage/s3-almacen";
import { createFindicProveedor } from "@/server/uf/findic";
import { createUfService } from "@/server/uf/uf-service";

export const propiedadService = createPropiedadService(prisma);
export const ufService = createUfService(prisma, createFindicProveedor());
export const creditoService = createCreditoService(prisma, ufService);
export const creditoRegistroService = createCreditoRegistroService(prisma, ufService);
export const arrendatarioService = createArrendatarioService(prisma);
export const contratoService = createContratoService(prisma);
export const pagoService = createPagoService(prisma);
export const movimientoService = createMovimientoService(prisma);
export const dashboardService = createDashboardService(prisma, ufService);
export const documentoService = createDocumentoService(prisma, almacenDesdeEntorno(), {
  secretoToken: process.env.S3_SECRET_ACCESS_KEY ?? null,
});
