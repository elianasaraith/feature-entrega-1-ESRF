import { z } from "zod";
import { isRealCalendarDate, optionalText, positiveDecimal } from "./shared";

// Espejo de docs/data-model.md §4.2 y de los CHECK de PostgreSQL. Los CHECK
// siguen siendo la red de seguridad; aquí se rechaza antes con 400 por campo.

export const propiedadInputSchema = z
  .object({
    numeroDepartamento: z.string().trim().min(1, "Obligatorio"),
    direccion: optionalText,
    superficieM2: positiveDecimal(6, 2),
    valorCompraMonto: positiveDecimal(10, 4),
    valorCompraMoneda: z.enum(["UF", "CLP"]),
    fechaCompra: z
      .string()
      .refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD"),
    estacionamiento: optionalText,
    bodega: optionalText,
  })
  .superRefine((data, ctx) => {
    if (
      data.valorCompraMoneda === "CLP" &&
      /\.\d*[1-9]/.test(data.valorCompraMonto)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["valorCompraMonto"],
        message: "En CLP el monto no admite decimales",
      });
    }
  });

export type PropiedadInput = z.output<typeof propiedadInputSchema>;
