import { Landmark } from "lucide-react";
import { uf } from "../_lib/format";
import { StatCard } from "../_ui";
import type { SaldoConsolidadoDto } from "@/server/services/dashboard-service";
import { formatearMontoClp } from "@/server/uf/equivalente";

// Solo presenta el consolidado ya calculado. Un saldo desconocido no se muestra como 0.
export function SaldoConsolidado({ saldo }: { saldo: SaldoConsolidadoDto }) {
  const { creditos } = saldo;
  const icono = <Landmark aria-hidden className="h-4 w-4" />;
  if (saldo.totalUf === null) {
    return (
      <StatCard
        etiqueta="Saldo hipotecario"
        valor={<span className="text-lg text-muted">Sin saldo registrado</span>}
        icono={icono}
        nota={<span className="text-muted">Ningún crédito tiene saldo conocido.</span>}
      />
    );
  }
  return (
    <StatCard
      etiqueta="Saldo hipotecario"
      valor={uf(saldo.totalUf)}
      icono={icono}
      detalle={<>CLP: {saldo.equivalenteClp ? formatearMontoClp(saldo.equivalenteClp) : "No disponible"}</>}
      nota={
        saldo.estado === "PARCIAL" ? (
          <span className="font-medium text-warning">
            Consolidado parcial: {creditos.conSaldo} de {creditos.total} créditos con saldo conocido ({creditos.sinSaldo} sin saldo, no incluidos).
          </span>
        ) : (
          <span className="text-muted">
            {creditos.conSaldo} de {creditos.total} créditos con saldo conocido.
          </span>
        )
      }
    />
  );
}
