import "server-only";

// Único punto donde T04 lee el reloj: «hoy» en Chile, como YYYY-MM-DD. Se pasa
// como referencia a las funciones de dominio, que nunca leen el reloj.
export function hoyChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}
