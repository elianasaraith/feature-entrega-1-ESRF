import { z } from "zod";
import {
  isRealCalendarDate,
  nonNegativeDecimal,
  positiveIntegerText,
  vacioANull,
  yearMonth,
} from "./shared";

// Espejo de docs/data-model.md §4.4 y de los CHECK de la migración. Sin reglas
// cruzadas que el modelo no define (fecha de pago vs período, saldo vs saldo
// inicial, límite de períodos futuros).

const camposRegistro = {
  // NUMERIC(14,0): CLP entero.
  dividendoPagadoClp: vacioANull(positiveIntegerText(14)),
  fechaPagoDividendo: vacioANull(
    z
      .string()
      .refine(isRealCalendarDate, "Debe ser una fecha válida con formato YYYY-MM-DD")
  ),
  // NUMERIC(12,4): UF, 0 permitido.
  saldoPendienteUf: vacioANull(nonNegativeDecimal(8, 4)),
};

type Fila = {
  dividendoPagadoClp: string | null;
  fechaPagoDividendo: string | null;
  saldoPendienteUf: string | null;
};

// Reglas de fila: al menos un dato, y fecha de pago si y solo si hay dividendo.
function reglasDeFila(fila: Fila, ctx: z.RefinementCtx) {
  if (fila.dividendoPagadoClp === null && fila.saldoPendienteUf === null) {
    ctx.addIssue({
      code: "custom",
      path: ["saldoPendienteUf"],
      message: "Registre al menos el saldo pendiente o el dividendo pagado",
    });
  }
  if (fila.dividendoPagadoClp !== null && fila.fechaPagoDividendo === null) {
    ctx.addIssue({
      code: "custom",
      path: ["fechaPagoDividendo"],
      message: "Obligatoria cuando hay dividendo pagado",
    });
  }
  if (fila.dividendoPagadoClp === null && fila.fechaPagoDividendo !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["fechaPagoDividendo"],
      message: "Debe estar vacía cuando no hay dividendo pagado",
    });
  }
}

export const registroMensualCrearSchema = z
  .object({ periodo: yearMonth, ...camposRegistro })
  .superRefine(reglasDeFila);

// El período va en la URL y no se puede modificar.
export const registroMensualActualizarSchema = z
  .object(camposRegistro)
  .superRefine(reglasDeFila);

export const periodoSchema = yearMonth;

export type RegistroMensualCrearInput = z.output<typeof registroMensualCrearSchema>;
export type RegistroMensualActualizarInput = z.output<typeof registroMensualActualizarSchema>;
