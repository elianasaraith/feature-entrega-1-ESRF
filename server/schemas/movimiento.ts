import { z } from "zod";
import { CATEGORIAS_MOVIMIENTO } from "@/server/domain/movimiento-agregacion";
import { MAX_CONCEPTOS, MAX_NOMBRE_CONCEPTO } from "@/server/domain/movimiento-desglose";
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

// Concepto de un gasto desglosado. El monto sigue la misma regla de formato: 0 y
// negativos pasan aquí y los rechaza el servicio (→ 422).
const concepto = z.object({
  nombre: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(MAX_NOMBRE_CONCEPTO, `Máximo ${MAX_NOMBRE_CONCEPTO} caracteres`),
  montoClp,
});

// `conceptos` es una lista opcional y NUNCA nula: null es un error de formato.
// La ausencia y la lista vacía son cosas distintas (en la edición, ausente
// conserva el desglose y [] lo elimina).
const conceptos = z
  .array(concepto, { error: "Debe ser una lista de conceptos" })
  .max(MAX_CONCEPTOS, `Máximo ${MAX_CONCEPTOS} conceptos`);

const base = z.object({
  fecha: z.string().refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD"),
  categoria: z.enum(CATEGORIAS_MOVIMIENTO, { error: "Categoría no permitida" }),
  montoClp: montoClp.optional(),
  descripcion: optionalText,
  conceptos: conceptos.optional(),
});

type Base = z.output<typeof base>;

// Las claves opcionales solo aparecen si vinieron en el cuerpo: para un gasto
// simple sin `conceptos` la salida es idéntica a la de antes del desglose.
function normalizar({ montoClp, conceptos, ...resto }: Base) {
  return {
    ...resto,
    ...(montoClp !== undefined ? { montoClp } : {}),
    ...(conceptos !== undefined ? { conceptos } : {}),
  };
}

// Alta: el monto es obligatorio salvo que haya conceptos (entonces el servidor
// calcula el total). `conceptos: []` es un gasto simple y también exige el monto.
export const movimientoInputSchema = base
  .superRefine((d, ctx) => {
    if (d.montoClp === undefined && !(d.conceptos && d.conceptos.length > 0)) {
      ctx.addIssue({ code: "custom", path: ["montoClp"], message: "El monto es obligatorio" });
    }
  })
  .transform(normalizar);

// Edición (PUT): `montoClp` puede omitirse con `conceptos` ausente, porque en un
// gasto desglosado eso significa «no tocar el desglose»; si el movimiento resulta
// ser simple, el servicio exige el monto (mismo 400). Con `conceptos: []` (convertir
// a simple) el monto es obligatorio.
export const movimientoEdicionSchema = base
  .superRefine((d, ctx) => {
    if (d.montoClp === undefined && d.conceptos !== undefined && d.conceptos.length === 0) {
      ctx.addIssue({ code: "custom", path: ["montoClp"], message: "El monto es obligatorio al convertir a gasto simple" });
    }
  })
  .transform(normalizar);

export type MovimientoInput = z.output<typeof movimientoInputSchema>;
export type MovimientoEdicionInput = z.output<typeof movimientoEdicionSchema>;
export type ConceptoInput = z.output<typeof concepto>;
