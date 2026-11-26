import { z } from "zod";
import { isRealCalendarDate, optionalText } from "./shared";

// Espejo de docs/data-model.md §4.9. Aquí solo se valida el FORMATO (→ 400): el
// monto es un entero CLP en texto, con signo opcional para que 0 y negativos
// lleguen al servicio, que los rechaza como regla de negocio (→ 422), igual que
// la fecha de recepción futura. Sin tope sobre el monto esperado.
const montoClp = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(/^-?\d+$/, { error: "Debe ser un entero sin decimales", abort: true })
      .refine((v) => v.replace(/^-/, "").replace(/^0+(?=\d)/, "").length <= 14, "Excede el rango permitido")
  );

// Alta y edición comparten cuerpo: la edición reemplaza monto, fecha y medio.
// El pago esperado de un abono no es editable (no hay campo para moverlo).
export const abonoInputSchema = z.object({
  montoClp,
  fechaRecepcion: z
    .string()
    .refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD"),
  medio: optionalText,
});

export type AbonoInput = z.output<typeof abonoInputSchema>;
