import type { ReactNode } from "react";
import { cn } from "../_lib/cn";

export type TonoBadge = "neutral" | "positive" | "negative" | "warning" | "info";
const TONOS: Record<TonoBadge, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  positive: "bg-positive-50 text-emerald-800 ring-emerald-200",
  negative: "bg-negative-50 text-red-800 ring-red-200",
  warning: "bg-warning-50 text-amber-800 ring-amber-200",
  info: "bg-brand-50 text-blue-800 ring-blue-200",
};

export function Badge({ tono = "neutral", children, className }: { tono?: TonoBadge; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONOS[tono], className)}>
      {children}
    </span>
  );
}

// Estados de pago de arriendo (T06). Solo presenta el estado ya calculado.
const ESTADO_PAGO: Record<string, [string, TonoBadge]> = {
  PENDIENTE: ["Pendiente", "warning"],
  PARCIALMENTE_PAGADO: ["Parcialmente pagado", "info"],
  VENCIDO: ["Vencido", "negative"],
  PAGADO: ["Pagado", "positive"],
};

export function BadgeEstadoPago({ estado }: { estado: string }) {
  const [etiqueta, tono] = ESTADO_PAGO[estado] ?? [estado, "neutral" as TonoBadge];
  return <Badge tono={tono}>{etiqueta}</Badge>;
}
