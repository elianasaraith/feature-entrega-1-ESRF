import { Prisma } from "@prisma/client";

// Pie estimado del crédito (change porcentaje-pie-hipotecario). Función pura: valor
// de compra × porcentaje / 100, en la moneda original del valor de compra. Sin
// Number ni conversión de moneda; el redondeo (half-up) se aplica solo al final:
// CLP a entero y UF a 4 decimales. No se persiste ni es un egreso.
const Decimal = Prisma.Decimal.clone({ precision: 40 });

export type PieEstimadoDto = {
  montoEstimado: string;
  moneda: "UF" | "CLP";
  restoPorcentaje: string; // 100 − porcentaje de pie, como texto decimal
};

export function calcularPieEstimado(
  valorCompraMonto: string,
  moneda: "UF" | "CLP",
  porcentajePie: string | null
): PieEstimadoDto | null {
  if (porcentajePie === null) return null;
  const pct = new Decimal(porcentajePie);
  if (!pct.isFinite() || pct.lt(0) || pct.gt(100)) {
    throw new RangeError("El porcentaje de pie debe estar entre 0 y 100");
  }
  const monto = new Decimal(valorCompraMonto).mul(pct).div(100);
  return {
    montoEstimado: monto.toFixed(moneda === "CLP" ? 0 : 4, Decimal.ROUND_HALF_UP),
    moneda,
    restoPorcentaje: new Decimal(100).minus(pct).toFixed(),
  };
}
