import { z } from "zod";
import { CATEGORIAS_MOVIMIENTO } from "@/server/domain/movimiento-agregacion";
import { isRealCalendarDate, optionalText } from "./shared";

// Espejo de docs/data-model.md §4.10. Aquí solo se valida el FORMATO (→ 400):
// el monto es un entero CLP en texto, con signo opcional para que 0 y negativos
// lleguen al servicio, que los rechaza como regla de negocio (→ 422), igual que
// la fecha futura. Sin `tipo` ni `DIVIDENDO`: Zod descarta claves desconocidas y
// el enum rechaza cualquier otra categoría.
const montoClp = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(/^-?\d+$/, { error: "Debe ser un entero sin decimales", abort: true })
      .refine((v) => v.replace(/^-/, "").replace(/^0+(?=\d)/, "").length <= 14, "Excede el rango permitido")
  );

// Alta y edición comparten cuerpo: la edición reemplaza todos los campos.
export const movimientoInputSchema = z.object({
  fecha: z.string().refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD"),
  categoria: z.enum(CATEGORIAS_MOVIMIENTO, { error: "Categoría no permitida" }),
  montoClp,
  descripcion: optionalText,
});

export type MovimientoInput = z.output<typeof movimientoInputSchema>;
