import { clp } from "../_lib/format";
import { cn } from "../_lib/cn";
import type { TotalesDto } from "@/server/services/dashboard-service";

// Solo presenta cifras ya calculadas por dashboard-service: sin cálculo
// financiero en el componente.
export function ResumenMensual({ totales }: { totales: TotalesDto }) {
  const filas: [string, string][] = [
    ["Arriendos recibidos", totales.ingresosClp],
    ["Dividendos pagados", totales.dividendosClp],
    ["Otros egresos", totales.otrosEgresosClp],
  ];
  const neto = totales.flujoNetoClp;
  return (
    <dl className="divide-y divide-line rounded-lg border border-line text-sm">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted">{etiqueta}</dt>
          <dd className="tabular-nums text-ink">{clp(valor)}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 bg-canvas/60 px-4 py-2.5 font-semibold">
        <dt>Egresos totales</dt>
        <dd className="tabular-nums">{clp(totales.egresosTotalesClp)}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 bg-canvas/60 px-4 py-2.5 font-semibold">
        <dt>Flujo neto</dt>
        <dd className={cn("tabular-nums", neto.startsWith("-") ? "text-negative" : neto !== "0" ? "text-positive" : "text-ink")}>
          {clp(neto)}
        </dd>
      </div>
    </dl>
  );
}
