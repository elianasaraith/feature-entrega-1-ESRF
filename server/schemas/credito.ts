import { z } from "zod";
import {
  isRealCalendarDate,
  nonNegativeDecimal,
  optionalText,
  positiveDecimal,
} from "./shared";

// Espejo de docs/data-model.md §4.3 y de los CHECK de la migración. No añade
// reglas cruzadas que el modelo no define (saldo vs monto original, fechas,
// unicidad de numero_credito, día 31 vs mes).

// Entero en [min, max]; acepta número o texto de dígitos. No son montos, así
// que Number es seguro dentro del rango de la columna.
function integerInRange(min: number, max: number, message: string) {
  return z
    .union([z.number(), z.string()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(/^\d+$/, { error: "Debe ser un número entero", abort: true })
        .transform(Number)
        .refine((n) => n >= min && n <= max, message)
    );
}

// UF: NUMERIC(12,4). Tasa: NUMERIC(6,4).
const montoUfPositivo = positiveDecimal(8, 4);
const montoUfNoNegativo = nonNegativeDecimal(8, 4);

const optionalDecimal = (schema: z.ZodType<string>) =>
  z
    .union([z.null(), z.literal("").transform(() => null), schema])
    .optional()
    .transform((v) => v ?? null);

export const creditoInputSchema = z.object({
  banco: z.string().trim().min(1, "Obligatorio"),
  numeroCredito: optionalText,
  fechaOtorgamiento: z
    .union([
      z.null(),
      z.literal("").transform(() => null),
      z
        .string()
        .refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD"),
    ])
    .optional()
    .transform((v) => v ?? null),
  montoOriginalUf: optionalDecimal(montoUfPositivo),
  cuotaContractualUf: montoUfPositivo,
  tasaInteresAnual: nonNegativeDecimal(2, 4),
  numeroCuotasTotal: integerInRange(1, 2147483647, "Debe ser un entero mayor que 0"),
  segurosUf: optionalDecimal(montoUfNoNegativo),
  diaVencimiento: integerInRange(1, 31, "Debe estar entre 1 y 31"),
  saldoInicialUf: optionalDecimal(montoUfNoNegativo),
});

export type CreditoInput = z.output<typeof creditoInputSchema>;
