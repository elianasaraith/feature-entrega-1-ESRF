import { formatearUf } from "@/server/domain/dashboard";
import type { SaldoConsolidadoDto } from "@/server/services/dashboard-service";
import { formatearMontoClp } from "@/server/uf/equivalente";

// Solo presenta el consolidado ya calculado. Un saldo desconocido no se muestra como 0.
export function SaldoConsolidado({ saldo }: { saldo: SaldoConsolidadoDto }) {
  const { creditos } = saldo;
  if (saldo.totalUf === null) return <p className="text-sm">Sin saldo registrado.</p>;
  return (
    <div className="text-sm">
      <p className="tabular-nums">
        <span className="font-semibold">{formatearUf(saldo.totalUf)} UF</span>
        {" · CLP: "}
        {saldo.equivalenteClp ? formatearMontoClp(saldo.equivalenteClp) : "No disponible"}
      </p>
      {saldo.estado === "PARCIAL" ? (
        <p className="mt-1 font-medium">
          Consolidado parcial: {creditos.conSaldo} de {creditos.total} créditos tienen saldo conocido (
          {creditos.sinSaldo} sin saldo registrado, no incluidos en el total).
        </p>
      ) : (
        <p className="mt-1 text-xs text-black/60">
          {creditos.conSaldo} de {creditos.total} créditos con saldo conocido.
        </p>
      )}
    </div>
  );
}
