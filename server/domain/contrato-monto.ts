// Montos y períodos de un contrato (docs/data-model.md §4.7, §4.8, §6). Funciones
// puras: sin reloj ni base de datos. Los períodos se expresan como YYYY-MM-01 y
// se comparan como texto.

export type FilaMonto = { vigenteDesdePeriodo: string; montoMensualClp: string };

// Monto de la fila con el mayor vigenteDesdePeriodo <= periodo, o null si
// ninguna rige todavía.
export function montoVigenteEn(filas: FilaMonto[], periodo: string): string | null {
  let vigente: FilaMonto | null = null;
  for (const fila of filas) {
    if (
      fila.vigenteDesdePeriodo <= periodo &&
      (!vigente || fila.vigenteDesdePeriodo > vigente.vigenteDesdePeriodo)
    ) {
      vigente = fila;
    }
  }
  return vigente?.montoMensualClp ?? null;
}

// Mes de una fecha YYYY-MM-DD o YYYY-MM como YYYY-MM-01.
export const periodoDe = (fecha: string) => `${fecha.slice(0, 7)}-01`;

// Meses día 1 entre dos períodos, ambos inclusivos; vacío si desde > hasta.
export function periodosEntre(desde: string, hasta: string): string[] {
  const periodos: string[] = [];
  let [anio, mes] = desde.slice(0, 7).split("-").map(Number);
  const limite = hasta.slice(0, 7);
  for (;;) {
    const actual = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
    if (actual > limite) return periodos;
    periodos.push(`${actual}-01`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
}

// Día esperado de pago dentro del período; si el mes no tiene ese día (31 en
// febrero), el último día del mes.
export function fechaEsperada(periodo: string, dia: number): string {
  const [anio, mes] = periodo.slice(0, 7).split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${periodo.slice(0, 7)}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}
