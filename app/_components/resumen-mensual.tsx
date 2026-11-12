import { formatearClp } from "@/server/domain/dashboard";
import type { TotalesDto } from "@/server/services/dashboard-service";

// Solo presenta cifras ya calculadas por dashboard-service: sin cálculo
// financiero en el componente.
export function ResumenMensual({ totales }: { totales: TotalesDto }) {
  const filas: [string, string][] = [
    ["Arriendos recibidos", totales.ingresosClp],
    ["Dividendos pagados", totales.dividendosClp],
    ["Otros egresos", totales.otrosEgresosClp],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="contents">
          <dt>{etiqueta}</dt>
          <dd className="text-right tabular-nums">$ {formatearClp(valor)}</dd>
        </div>
      ))}
      <div className="contents font-semibold">
        <dt className="border-t pt-2">Egresos totales</dt>
        <dd className="border-t pt-2 text-right tabular-nums">$ {formatearClp(totales.egresosTotalesClp)}</dd>
      </div>
      <div className="contents font-semibold">
        <dt>Flujo neto antes de aportes</dt>
        <dd className="text-right tabular-nums">$ {formatearClp(totales.flujoNetoClp)}</dd>
      </div>
    </dl>
  );
}
