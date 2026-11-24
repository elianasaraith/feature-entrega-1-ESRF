import { clp, mesLargo } from "../_lib/format";
import { cn } from "../_lib/cn";
import { DataTable, Td, Th } from "../_ui";
import type { PeriodoHistoricoDto } from "@/server/services/dashboard-service";

// Solo presenta totales ya calculados por dashboard-service.
export function HistoricoMensual({ periodos }: { periodos: PeriodoHistoricoDto[] }) {
  return (
    <DataTable>
      <caption className="sr-only">Histórico mensual de ingresos, egresos y flujo neto</caption>
      <thead>
        <tr>
          <Th>Mes</Th>
          <Th alinear="right">Ingresos</Th>
          <Th alinear="right">Dividendos</Th>
          <Th alinear="right">Otros egresos</Th>
          <Th alinear="right">Egresos totales</Th>
          <Th alinear="right">Flujo neto</Th>
        </tr>
      </thead>
      <tbody>
        {periodos.map((p) => (
          <tr key={p.mes}>
            <Td className="whitespace-nowrap capitalize">{mesLargo(p.mes)}</Td>
            <Td numerico>{clp(p.ingresosClp)}</Td>
            <Td numerico>{clp(p.dividendosClp)}</Td>
            <Td numerico>{clp(p.otrosEgresosClp)}</Td>
            <Td numerico>{clp(p.egresosTotalesClp)}</Td>
            <Td numerico className={cn("font-medium", p.flujoNetoClp.startsWith("-") && "text-negative")}>
              {clp(p.flujoNetoClp)}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
