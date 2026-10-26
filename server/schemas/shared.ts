import { z } from "zod";

// Helpers de validación compartidos por los esquemas de propiedad y crédito.
// Los montos viajan como texto decimal: nunca pasan por Number/float.

function decimal(maxIntDigits: number, maxDecimals: number, allowZero: boolean) {
  const base = z
    .union([z.number(), z.string()])
    .transform((v) => String(v).trim())
    .pipe(
      z
        .string()
        .regex(/^-?\d+(\.\d+)?$/, { error: "Debe ser un número decimal", abort: true })
    );

  const sinSigno = base.refine((v) => !v.startsWith("-"), {
    error: allowZero ? "No puede ser negativo" : "Debe ser mayor que 0",
    abort: true,
  });

  return (allowZero
    ? sinSigno
    : sinSigno.refine((v) => /[1-9]/.test(v), "Debe ser mayor que 0")
  )
    .refine(
      (v) => (v.split(".")[1] ?? "").length <= maxDecimals,
      `Máximo ${maxDecimals} decimales`
    )
    .refine(
      (v) => v.split(".")[0].replace(/^0+(?=\d)/, "").length <= maxIntDigits,
      "Excede el rango permitido"
    );
}

// Número > 0 con límites de precisión de la columna NUMERIC(p, s).
export function positiveDecimal(maxIntDigits: number, maxDecimals: number) {
  return decimal(maxIntDigits, maxDecimals, false);
}

// Número >= 0 con límites de precisión de la columna NUMERIC(p, s).
export function nonNegativeDecimal(maxIntDigits: number, maxDecimals: number) {
  return decimal(maxIntDigits, maxDecimals, true);
}

// Fecha calendario real: "2026-02-30" cumple el formato pero no existe.
export function isRealCalendarDate(value: string): boolean {
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
export const optionalText = z
  .string()
  .nullish()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : null;
  });
