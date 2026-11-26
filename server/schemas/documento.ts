import { z } from "zod";
import { TIPOS_DOCUMENTO, errorDeArchivo } from "@/server/domain/documento";

// Vínculo específico opcional y excluyente (data-model.md §4.13).
export const vinculoSchema = z.object({
  tipo: z.enum(["CREDITO", "CONTRATO", "ABONO", "MOVIMIENTO"]),
  id: z.string().uuid("Debe ser un UUID"),
});

export const subidaSchema = z
  .object({
    tipo: z.enum(TIPOS_DOCUMENTO),
    nombreArchivo: z.string().trim().min(1, "Obligatorio").max(255, "Máximo 255 caracteres"),
    mimeType: z.string().trim().min(1, "Obligatorio").max(100, "Máximo 100 caracteres"),
    tamanoBytes: z.number().int("Debe ser un entero"),
    vinculo: vinculoSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    const motivo = errorDeArchivo(v.mimeType, v.tamanoBytes);
    if (motivo) {
      const campo = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(v.mimeType) ? "tamanoBytes" : "mimeType";
      ctx.addIssue({ code: "custom", path: [campo], message: motivo });
    }
  });

export const registroSchema = subidaSchema.safeExtend({
  // Clave TEMPORAL emitida por el servidor (la forma exacta se valida en el servicio).
  storageKey: z.string().trim().min(1, "Obligatorio").max(512, "Máximo 512 caracteres"),
  // Autorización emitida por el servidor al solicitar la subida.
  tokenSubida: z.string().trim().min(1, "Obligatorio").max(512, "Máximo 512 caracteres"),
});

export type SubidaInput = z.output<typeof subidaSchema>;
export type RegistroInput = z.output<typeof registroSchema>;
