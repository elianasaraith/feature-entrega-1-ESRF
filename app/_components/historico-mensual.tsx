import { formatearClp } from "@/server/domain/dashboard";
import type { PeriodoHistoricoDto } from "@/server/services/dashboard-service";

// Solo presenta totales ya calculados por dashboard-service.
export function HistoricoMensual({ periodos }: { periodos: PeriodoHistoricoDto[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2">Mes</th>
          <th className="text-right">Ingresos</th>
          <th className="text-right">Dividendos</th>
          <th className="text-right">Otros egresos</th>
          <th className="text-right">Egresos totales</th>
          <th className="text-right">Flujo neto</th>
        </tr>
      </thead>
      <tbody>
        {periodos.map((p) => (
          <tr key={p.mes} className="border-b">
            <td className="py-2">{p.mes}</td>
            <td className="text-right tabular-nums">$ {formatearClp(p.ingresosClp)}</td>
            <td className="text-right tabular-nums">$ {formatearClp(p.dividendosClp)}</td>
            <td className="text-right tabular-nums">$ {formatearClp(p.otrosEgresosClp)}</td>
            <td className="text-right tabular-nums">$ {formatearClp(p.egresosTotalesClp)}</td>
            <td className="text-right tabular-nums">$ {formatearClp(p.flujoNetoClp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
