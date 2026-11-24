import type { ReactNode } from "react";
import { cn } from "../_lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-card", className)}>{children}</div>;
}

export function CardHeader({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-muted">{descripcion}</p>}
      </div>
      {acciones}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

type Tono = "neutral" | "positive" | "negative" | "warning";
const TONO_VALOR: Record<Tono, string> = {
  neutral: "text-ink",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
};

export function StatCard({
  etiqueta,
  valor,
  tono = "neutral",
  icono,
  detalle,
  nota,
}: {
  etiqueta: string;
  valor: ReactNode;
  tono?: Tono;
  icono?: ReactNode;
  detalle?: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{etiqueta}</p>
        {icono && <span className="text-muted">{icono}</span>}
      </div>
      <p className={cn("mt-2 break-words text-2xl font-semibold tabular-nums", TONO_VALOR[tono])}>{valor}</p>
      {detalle && <p className="mt-1 text-sm tabular-nums text-muted">{detalle}</p>}
      {nota && <div className="mt-2 text-xs">{nota}</div>}
    </Card>
  );
}
