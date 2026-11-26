// Agregación mensual de movimientos financieros (docs/data-model.md §4.10, §6).
// Funciones puras: sin reloj ni base de datos. Los montos CLP son enteros en
// texto y se suman como bigint, nunca como float.

export const CATEGORIAS_MOVIMIENTO = [
  "REPARACION",
  "EQUIPAMIENTO",
  "SEGURO",
  "CONTRIBUCIONES",
  "GASTO_COMUN",
  "GASTO_EXTRAORDINARIO",
  "OTRO",
] as const;

export type CategoriaMovimiento = (typeof CATEGORIAS_MOVIMIENTO)[number];

export type MovimientoEntrada = { categoria: CategoriaMovimiento; montoClp: string };

export type ResumenMovimientos = {
  totalClp: string;
  porCategoria: Record<CategoriaMovimiento, string>;
};

// Total y subtotal de las 7 categorías; las vacías figuran con "0".
export function agregarPorCategoria(movimientos: MovimientoEntrada[]): ResumenMovimientos {
  const subtotales = Object.fromEntries(
    CATEGORIAS_MOVIMIENTO.map((c) => [c, BigInt(0)])
  ) as Record<CategoriaMovimiento, bigint>;
  let total = BigInt(0);
  for (const m of movimientos) {
    const monto = BigInt(m.montoClp);
    subtotales[m.categoria] += monto;
    total += monto;
  }
  const porCategoria = Object.fromEntries(
    CATEGORIAS_MOVIMIENTO.map((c) => [c, subtotales[c].toString()])
  ) as Record<CategoriaMovimiento, string>;
  return { totalClp: total.toString(), porCategoria };
}

// Límites del mes calendario `YYYY-MM`: `desde` inclusivo, `hasta` exclusivo
// (día 1 del mes siguiente), ambos YYYY-MM-DD.
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? [anio + 1, 1] : [anio, m + 1];
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    desde: `${anio}-${dos(m)}-01`,
    hasta: `${siguiente[0]}-${dos(siguiente[1])}-01`,
  };
}
