// Vigencia de un contrato, derivada de sus fechas (docs/data-model.md §4.6, D12).
// No se persiste. Función pura: la fecha de referencia se inyecta, nunca se lee
// del reloj aquí. Fechas en formato YYYY-MM-DD (se comparan como texto);
// ambos extremos del contrato son inclusivos.
export type Vigencia = "FUTURO" | "VIGENTE" | "FINALIZADO";

export function vigenciaDe(
  contrato: { fechaInicio: string; fechaTermino: string },
  referencia: string
): Vigencia {
  if (referencia < contrato.fechaInicio) return "FUTURO";
  if (referencia > contrato.fechaTermino) return "FINALIZADO";
  return "VIGENTE";
}
