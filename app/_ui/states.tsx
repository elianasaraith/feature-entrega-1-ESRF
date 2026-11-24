import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, Loader2 } from "lucide-react";
import { cn } from "../_lib/cn";

export function EmptyState({ titulo, descripcion, accion, icono }: { titulo: string; descripcion?: string; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-muted">
        {icono ?? <Inbox aria-hidden className="h-5 w-5" />}
      </span>
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-muted">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function LoadingState({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {texto}
    </div>
  );
}

export function ErrorState({ titulo = "Ocurrió un problema", descripcion, accion }: { titulo?: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-negative-50 text-negative">
        <AlertCircle aria-hidden className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-muted">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

type TonoAlerta = "error" | "success" | "warning" | "info";
const ALERTA: Record<TonoAlerta, { caja: string; icono: ReactNode }> = {
  error: { caja: "border-red-200 bg-negative-50 text-red-900", icono: <AlertCircle aria-hidden className="h-4 w-4" /> },
  success: { caja: "border-emerald-200 bg-positive-50 text-emerald-900", icono: <CheckCircle2 aria-hidden className="h-4 w-4" /> },
  warning: { caja: "border-amber-200 bg-warning-50 text-amber-900", icono: <AlertTriangle aria-hidden className="h-4 w-4" /> },
  info: { caja: "border-blue-200 bg-brand-50 text-blue-900", icono: <Info aria-hidden className="h-4 w-4" /> },
};

export function Alert({ tono = "info", children, className }: { tono?: TonoAlerta; children: ReactNode; className?: string }) {
  const { caja, icono } = ALERTA[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm", caja, className)}>
      <span className="mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
