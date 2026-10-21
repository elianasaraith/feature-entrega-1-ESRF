import { z } from "zod";

// Espejo de docs/data-model.md §4.2 y de los CHECK de PostgreSQL. Los CHECK
// siguen siendo la red de seguridad; aquí se rechaza antes con 400 por campo.

// Número positivo con límites de precisión de la columna NUMERIC(p, s).
// Acepta número o texto; devuelve texto decimal (nunca pasa por float).
function positiveDecimal(maxIntDigits: number, maxDecimals: number) {
  return z
    .union([z.number(), z.string()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(/^-?\d+(\.\d+)?$/, { error: "Debe ser un número decimal", abort: true })
        .refine((v) => !v.startsWith("-") && /[1-9]/.test(v), "Debe ser mayor que 0")
        .refine(
          (v) => (v.split(".")[1] ?? "").length <= maxDecimals,
          `Máximo ${maxDecimals} decimales`
        )
        .refine(
          (v) => v.split(".")[0].replace(/^0+(?=\d)/, "").length <= maxIntDigits,
          "Excede el rango permitido"
        )
    );
}

// Fecha calendario real: "2026-02-30" cumple el formato pero no existe.
function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Texto opcional: vacío o solo espacios → null.
const optionalText = z
  .string()
  .nullish()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : null;
  });

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
