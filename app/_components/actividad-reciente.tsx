import Link from "next/link";
import { clp, fecha } from "../_lib/format";
import { Badge, DataTable, EmptyState, Td, Th, type TonoBadge } from "../_ui";
import type { ActividadDto } from "@/server/services/dashboard-service";

const ORIGEN: Record<ActividadDto["origen"], [string, TonoBadge]> = {
  ABONO: ["Arriendo", "positive"],
  DIVIDENDO: ["Dividendo", "info"],
  MOVIMIENTO: ["Movimiento", "warning"],
};

// La lista ya llega ordenada (más reciente primero) desde dashboard-service.
export function ActividadReciente({ actividad }: { actividad: ActividadDto[] }) {
  if (actividad.length === 0) return <EmptyState titulo="Sin actividad en el mes" />;
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Fecha</Th>
          <Th>Concepto</Th>
          <Th>Origen</Th>
          <Th alinear="right">Importe</Th>
        </tr>
      </thead>
      <tbody>
        {actividad.map((a) => {
          const [etiqueta, tono] = ORIGEN[a.origen];
          return (
            <tr key={`${a.origen}-${a.id}`}>
              <Td className="whitespace-nowrap">{fecha(a.fecha)}</Td>
              <Td>{a.concepto}</Td>
              <Td>
                <Link href={a.href} className="hover:underline">
                  <Badge tono={tono}>{etiqueta}</Badge>
                </Link>
              </Td>
              <Td numerico className="whitespace-nowrap">{clp(a.montoClp)}</Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
