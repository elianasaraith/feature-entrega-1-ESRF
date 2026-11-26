import { porcentaje } from "../../../_lib/format";

// Presentación pura: los porcentajes llegan ya calculados (texto decimal) desde el
// servidor. La barra representa pie vs. resto del valor de compra; NO es el
// porcentaje financiado por el banco, que puede diferir del complemento del pie.
export function BarraPie({
  piePorcentaje,
  restoPorcentaje,
}: {
  piePorcentaje: string;
  restoPorcentaje: string;
}) {
  const descripcion = `Pie ${porcentaje(piePorcentaje)} y resto del valor de compra ${porcentaje(restoPorcentaje)}`;
  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={descripcion}
        className="flex h-3 w-full overflow-hidden rounded-full bg-line"
      >
        <div className="h-full bg-brand" style={{ width: `${piePorcentaje}%` }} />
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-brand" />
          Pie · <span className="tabular-nums">{porcentaje(piePorcentaje)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-line" />
          Resto del valor de compra · <span className="tabular-nums">{porcentaje(restoPorcentaje)}</span>
        </li>
      </ul>
    </div>
  );
}
