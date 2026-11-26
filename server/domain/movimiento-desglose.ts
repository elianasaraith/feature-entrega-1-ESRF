// Desglose de un gasto en conceptos (T07, ampliación; docs/data-model.md §4.10).
// Funciones puras: sin reloj ni base de datos, y sin depender de T09. Los montos
// CLP son enteros en texto y se suman como bigint, nunca como float. La usan el
// servicio (total del movimiento) y la interfaz (total en vivo).

export const MAX_CONCEPTOS = 50;
export const MAX_NOMBRE_CONCEPTO = 100;

// Texto de dígitos (entero no negativo), sin signo, decimales ni espacios.
export function esMontoEnteroTexto(valor: string): boolean {
  return /^\d+$/.test(valor);
}

// Suma exacta; lista vacía → "0". Lanza ante un valor que no es entero en texto:
// quien necesite tolerancia (p. ej. un campo a medio escribir) filtra antes con
// esMontoEnteroTexto.
export function sumarConceptos(montos: string[]): string {
  let total = BigInt(0);
  for (const monto of montos) {
    if (!esMontoEnteroTexto(monto)) {
      throw new Error(`Monto de concepto inválido: ${monto}`);
    }
    total += BigInt(monto);
  }
  return total.toString();
}
