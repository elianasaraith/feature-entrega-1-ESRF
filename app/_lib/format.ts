// Formatos de presentación centralizados. Reutiliza los formateadores de dominio
// existentes: no calcula ni redondea importes (los montos llegan como string).
import { formatearClp, formatearUf } from "@/server/domain/dashboard";

export { formatearClp, formatearUf };

// Negativos con el signo delante del símbolo: -30000 → "-$30.000".
export function clp(monto: string): string {
  const t = formatearClp(monto);
  return t.startsWith("-") ? `-$${t.slice(1)}` : `$${t}`;
}

export function uf(monto: string): string {
  return `${formatearUf(monto)} UF`;
}

// "20.5" → "20,5 %"; sin Number ni ceros finales (reutiliza el formato decimal de UF).
export function porcentaje(valor: string): string {
  return `${formatearUf(valor)} %`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-03" → "marzo 2026"
export function mesLargo(mes: string): string {
  const [y, m] = mes.split("-");
  const nombre = MESES[Number(m) - 1];
  return nombre ? `${nombre} ${y}` : mes;
}

// "2026-03" → "mar 26"
export function mesCorto(mes: string): string {
  const [y, m] = mes.split("-");
  const nombre = MESES[Number(m) - 1];
  return nombre ? `${nombre.slice(0, 3)} ${y.slice(2)}` : mes;
}

// "2026-03-15" → "15-03-2026"
export function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

// Decimal textual → separador de miles "." y decimal ",", sin pasar por Number
// (se conserva la precisión). "48.5" → "48,5"; "4.90" → "4,9".
export function decimal(valor: string): string {
  const negativo = valor.startsWith("-");
  const [entera, dec = ""] = valor.replace(/^-/, "").split(".");
  const grupos = entera.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const d = dec.replace(/0+$/, "");
  return `${negativo ? "-" : ""}${grupos}${d ? `,${d}` : ""}`;
}

export function m2(valor: string): string {
  return `${decimal(valor)} m²`;
}

// Monto en su moneda de origen: UF → "5.000 UF"; CLP → "$5.000.000".
export function montoMoneda(monto: string, moneda: string): string {
  return moneda === "UF" ? uf(monto) : moneda === "CLP" ? clp(monto) : `${decimal(monto)} ${moneda}`;
}
