import { z } from "zod";
import { arrendatarioInputSchema } from "./arrendatario";
import {
  isRealCalendarDate,
  nonNegativeIntegerText,
  optionalText,
  positiveIntegerText,
  vacioANull,
} from "./shared";

// Espejo de docs/data-model.md §4.6 y de los CHECK de la migración. El monto
// inicial solo existe en el alta (T04): la edición no lo acepta ni lo modifica;
// reajustes y nuevas filas de contrato_monto son T05.

const fecha = z
  .string()
  .refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD");

const camposContrato = {
  fechaInicio: fecha,
  fechaTermino: fecha,
  diaEsperadoPago: z
    .number({ error: "Debe ser un entero entre 1 y 31" })
    .int("Debe ser un entero entre 1 y 31")
    .min(1, "Debe ser un entero entre 1 y 31")
    .max(31, "Debe ser un entero entre 1 y 31"),
  // NUMERIC(14,0): CLP entero, 0 permitido. Solo información contractual.
  garantiaClp: vacioANull(nonNegativeIntegerText(14)),
  observaciones: optionalText,
};

type Fechas = { fechaInicio: string; fechaTermino: string };

// ISO YYYY-MM-DD se compara como texto; solo si ambas son fechas reales.
function terminoNoAnterior(c: Fechas, ctx: z.RefinementCtx) {
  if (
    isRealCalendarDate(c.fechaInicio) &&
    isRealCalendarDate(c.fechaTermino) &&
    c.fechaTermino < c.fechaInicio
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["fechaTermino"],
      message: "No puede ser anterior a la fecha de inicio",
    });
  }
}

// Alta: arrendatario existente (arrendatarioId) o nuevo (arrendatario), nunca
// ambos ni ninguno. montoMensualClp es opcional.
export const contratoCrearSchema = z
  .object({
    ...camposContrato,
    arrendatarioId: z.string().trim().min(1).nullish(),
    arrendatario: arrendatarioInputSchema.nullish(),
    montoMensualClp: vacioANull(positiveIntegerText(14)),
  })
  .superRefine((c, ctx) => {
    terminoNoAnterior(c, ctx);
    const tieneId = Boolean(c.arrendatarioId);
    const tieneNuevo = Boolean(c.arrendatario);
    if (tieneId === tieneNuevo) {
      ctx.addIssue({
        code: "custom",
        path: ["arrendatarioId"],
        message: "Indique arrendatarioId o arrendatario, pero no ambos",
      });
    }
  });

// Edición: cuerpo completo; el arrendatario debe existir. Las claves
// desconocidas (p. ej. montoMensualClp) se descartan y nunca se aplican.
export const contratoActualizarSchema = z
  .object({
    ...camposContrato,
    arrendatarioId: z.string().trim().min(1, "Obligatorio"),
  })
  .superRefine(terminoNoAnterior);

export type ContratoCrearInput = z.output<typeof contratoCrearSchema>;
export type ContratoActualizarInput = z.output<typeof contratoActualizarSchema>;
