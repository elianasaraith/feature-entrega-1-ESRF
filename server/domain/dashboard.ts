// Funciones puras del dashboard financiero (T09). Sin reloj ni base de datos.
// Los importes CLP son enteros en texto y se operan como bigint; la UF es un
// decimal en texto que nunca pasa por Number. Nada de esto se persiste.

const ZERO = BigInt(0);

export function sumarMontos(montos: string[]): string {
  let total = ZERO;
  for (const m of montos) total += BigInt(m);
  return total.toString();
}

// Flujo neto = ingresos − egresos; puede ser negativo.
export function flujoNeto(ingresosClp: string, egresosClp: string): string {
  return (BigInt(ingresosClp) - BigInt(egresosClp)).toString();
}

export type OrigenActividad = "ABONO" | "DIVIDENDO" | "MOVIMIENTO";

export type ActividadEntrada = {
  id: string;
  origen: OrigenActividad;
  fecha: string; // YYYY-MM-DD, fecha efectiva de caja
  concepto: string;
  montoClp: string;
};

const ORDEN_ORIGEN: Record<OrigenActividad, number> = { ABONO: 0, DIVIDENDO: 1, MOVIMIENTO: 2 };

// Fecha efectiva descendente; desempate por origen y luego por id.
export function ordenarActividad<T extends ActividadEntrada>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.origen !== b.origen) return ORDEN_ORIGEN[a.origen] - ORDEN_ORIGEN[b.origen];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export type RegistroSaldo = { periodo: string; saldoPendienteUf: string | null };

// Registro con saldo no nulo y mayor `periodo` menor o igual al mes consultado
// (YYYY-MM). Nunca usa registros posteriores; sin candidato → null.
export function seleccionarSaldoAplicable(
  registros: RegistroSaldo[],
  mes: string
): { periodo: string; saldoPendienteUf: string } | null {
  let elegido: { periodo: string; saldoPendienteUf: string } | null = null;
  for (const r of registros) {
    if (r.saldoPendienteUf === null || r.periodo > mes) continue;
    if (!elegido || r.periodo > elegido.periodo) {
      elegido = { periodo: r.periodo, saldoPendienteUf: r.saldoPendienteUf };
    }
  }
  return elegido;
}

function agruparMiles(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "1234567" → "1.234.567"; "-150000" → "-150.000". Sin decimales ni Number.
export function formatearClp(montoClp: string): string {
  const negativo = montoClp.startsWith("-");
  const digitos = montoClp.replace(/^-/, "").replace(/^0+(?=\d)/, "");
  const texto = agruparMiles(digitos);
  return negativo && digitos !== "0" ? `-${texto}` : texto;
}

// "1234.5" → "1.234,5"; hasta 4 decimales, sin ceros finales.
export function formatearUf(montoUf: string): string {
  const negativo = montoUf.startsWith("-");
  const [entera, decimales = ""] = montoUf.replace(/^-/, "").split(".");
  const dec = decimales.slice(0, 4).replace(/0+$/, "");
  const parteEntera = agruparMiles(entera.replace(/^0+(?=\d)/, ""));
  const texto = dec ? `${parteEntera},${dec}` : parteEntera;
  return negativo ? `-${texto}` : texto;
}

// Etiqueta descriptiva de las calificaciones derivadas de T06 (data-model.md
// §6.1). Solo presenta lo que ya calculó calcularEstadoPago: no es un estado
// adicional y no se muestra cuando ninguna corresponde.
export function etiquetaCalificacionPago(pago: {
  vencidoConAbonosParciales: boolean;
  pagadoConAtraso: boolean;
}): string | null {
  if (pago.vencidoConAbonosParciales) return "vencido con abonos parciales";
  if (pago.pagadoConAtraso) return "pagado con atraso";
  return null;
}
