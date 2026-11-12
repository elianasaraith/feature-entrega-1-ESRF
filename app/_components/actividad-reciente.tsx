import Link from "next/link";
import { formatearClp } from "@/server/domain/dashboard";
import type { ActividadDto } from "@/server/services/dashboard-service";

const ORIGEN: Record<ActividadDto["origen"], string> = {
  ABONO: "Arriendo",
  DIVIDENDO: "Dividendo",
  MOVIMIENTO: "Movimiento",
};

// La lista ya llega ordenada (más reciente primero) desde dashboard-service.
export function ActividadReciente({ actividad }: { actividad: ActividadDto[] }) {
  if (actividad.length === 0) return <p className="text-sm">Sin actividad en el mes.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2">Fecha</th>
          <th>Concepto</th>
          <th>Origen</th>
          <th className="text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        {actividad.map((a) => (
          <tr key={`${a.origen}-${a.id}`} className="border-b">
            <td className="py-2">{a.fecha}</td>
            <td>{a.concepto}</td>
            <td>
              <Link href={a.href} className="underline">
                {ORIGEN[a.origen]}
              </Link>
            </td>
            <td className="text-right tabular-nums">$ {formatearClp(a.montoClp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
