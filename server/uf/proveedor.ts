import type { Prisma } from "@prisma/client";

// Puerto del proveedor de la UF (docs/architecture.md §12.1). Una sola operación:
// el valor de la UF de una fecha. Los fallos esperados del proveedor no lanzan:
// se devuelven como resultado para que quien consume decida cómo degradar.
export type ResultadoUf =
  | { tipo: "ok"; valorClp: Prisma.Decimal; fechaValor: string }
  | { tipo: "sin-datos" }
  | { tipo: "error"; motivo: string };

export interface ProveedorUf {
  // Identificador que se persiste en `valor_uf_periodo.fuente`.
  readonly fuente: string;
  // `fecha` en formato YYYY-MM-DD.
  obtener(fecha: string): Promise<ResultadoUf>;
}
