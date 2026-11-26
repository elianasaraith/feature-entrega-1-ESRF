// Estado de un pago de arriendo (docs/data-model.md §6.1). Función pura: sin
// reloj ni base de datos; «hoy» llega inyectado como YYYY-MM-DD (Chile). Fechas
// como texto ISO (se comparan lexicográficamente) y montos CLP enteros como
// bigint, nunca como float. Nada de lo que se calcula aquí se persiste.

export type EstadoPago = "PENDIENTE" | "PARCIALMENTE_PAGADO" | "VENCIDO" | "PAGADO";

export type AbonoEntrada = {
  id: string;
  montoClp: string;
  fechaRecepcion: string;
  createdAt: string;
};

export type PagoEntrada = {
  montoEsperadoClp: string;
  fechaEsperada: string;
  abonos: AbonoEntrada[];
};

export type EstadoPagoCalculado = {
  recibidoClp: string;
  saldoPendienteClp: string;
  estado: EstadoPago;
  // Fecha de recepción del primer abono cuyo acumulado alcanza el esperado.
  fechaCompletitud: string | null;
  // Calificaciones derivadas: nunca son estados adicionales.
  vencidoConAbonosParciales: boolean;
  pagadoConAtraso: boolean;
};

// Sin literales bigint: el target de tsconfig es anterior a ES2020.
const ZERO = BigInt(0);

// Orden determinista: fecha de recepción, luego created_at y por último id.
export function ordenarAbonos<T extends AbonoEntrada>(abonos: T[]): T[] {
  return [...abonos].sort(
    (a, b) =>
      a.fechaRecepcion.localeCompare(b.fechaRecepcion) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

export function calcularEstadoPago(pago: PagoEntrada, hoy: string): EstadoPagoCalculado {
  const esperado = BigInt(pago.montoEsperadoClp);
  const ordenados = ordenarAbonos(pago.abonos);

  let recibido = ZERO;
  let fechaCompletitud: string | null = null;
  for (const abono of ordenados) {
    recibido += BigInt(abono.montoClp);
    if (fechaCompletitud === null && recibido >= esperado) {
      fechaCompletitud = abono.fechaRecepcion;
    }
  }

  const vencido = pago.fechaEsperada < hoy;
  let estado: EstadoPago;
  if (recibido >= esperado) estado = "PAGADO";
  else if (vencido) estado = "VENCIDO";
  else if (recibido > ZERO) estado = "PARCIALMENTE_PAGADO";
  else estado = "PENDIENTE";

  return {
    recibidoClp: recibido.toString(),
    saldoPendienteClp: (recibido >= esperado ? ZERO : esperado - recibido).toString(),
    estado,
    fechaCompletitud: estado === "PAGADO" ? fechaCompletitud : null,
    vencidoConAbonosParciales: estado === "VENCIDO" && recibido > ZERO,
    pagadoConAtraso:
      estado === "PAGADO" && fechaCompletitud !== null && fechaCompletitud > pago.fechaEsperada,
  };
}
