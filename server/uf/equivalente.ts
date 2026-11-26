import { Prisma } from "@prisma/client";
import { formatearClp, formatearUf } from "../domain/dashboard";
import { convertirUfAClp } from "../domain/uf";
import type { ValorUfDto } from "./uf-service";

// Equivalente en CLP de un importe en UF (T10). Se calcula al consultar y NO se
// persiste. `valorClp` es el producto exacto como texto decimal, sin redondear
// (el redondeo es solo de presentación); `ufClp` y `fechaReferencia` identifican
// la UF utilizada. `null` = no disponible: falta el monto o el valor de la UF.
export type EquivalenteClpDto = {
  valorClp: string;
  ufClp: string;
  fechaReferencia: string;
} | null;

// Función pura: no lee base de datos, red ni reloj. Sin `number`: la aritmética
// la hace `convertirUfAClp` sobre Decimal.
export function calcularEquivalenteClp(
  montoUf: string | null,
  uf: ValorUfDto | undefined,
): EquivalenteClpDto {
  if (montoUf === null || uf === undefined) return null;
  return {
    valorClp: convertirUfAClp(montoUf, uf.valorClp),
    ufClp: uf.valorClp,
    fechaReferencia: uf.fechaValor,
  };
}

// --- Presentación (único lugar donde se redondea) ---
// Puras y sin `number`; los componentes solo muestran el texto resultante.

// CLP redondeado a entero (mitad hacia arriba) y con separador de miles.
export function formatearMontoClp(equivalente: NonNullable<EquivalenteClpDto>): string {
  const entero = new Prisma.Decimal(equivalente.valorClp).toFixed(0, Prisma.Decimal.ROUND_HALF_UP);
  return `$ ${formatearClp(entero)}`;
}

// Una UF utilizada, deduplicada: se muestra una sola vez aunque varios montos la usen.
export type ReferenciaUf = { fechaReferencia: string; ufClp: string };

// Referencias distintas (por fecha) de los equivalentes disponibles, de la más
// reciente a la más antigua. Sin equivalentes disponibles → lista vacía.
export function referenciasUf(equivalentes: EquivalenteClpDto[]): ReferenciaUf[] {
  const porFecha = new Map<string, ReferenciaUf>();
  for (const e of equivalentes) {
    if (e && !porFecha.has(e.fechaReferencia)) {
      porFecha.set(e.fechaReferencia, { fechaReferencia: e.fechaReferencia, ufClp: e.ufClp });
    }
  }
  return [...porFecha.values()].sort((a, b) => b.fechaReferencia.localeCompare(a.fechaReferencia));
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2026-11-01" → "noviembre 2026" (o "nov 2026" si `corta`).
export function etiquetaMes(fecha: string, corta = false): string {
  const [anio, mes] = fecha.split("-");
  const nombre = MESES[Number(mes) - 1] ?? mes;
  return `${corta ? nombre.slice(0, 3) : nombre} ${anio}`;
}

// "UF $ 41.252,94": valor de la UF en CLP.
export function formatearValorUf(ref: ReferenciaUf): string {
  return `UF $ ${formatearUf(ref.ufClp)}`;
}
