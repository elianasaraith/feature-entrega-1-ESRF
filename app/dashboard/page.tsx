import { Suspense } from "react";
import Link from "next/link";
import { hoyChile } from "@/server/clock";
import { etiquetaCalificacionPago, formatearClp, formatearUf } from "@/server/domain/dashboard";
import { yearMonth } from "@/server/schemas/shared";
import { dashboardService } from "@/server/services";
import { ResumenMensual } from "../_components/resumen-mensual";
import { SelectorMes } from "../_components/selector-mes";

type SearchParams = Promise<{ mes?: string | string[] }>;

const ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PARCIALMENTE_PAGADO: "Parcialmente pagado",
  VENCIDO: "Vencido",
  PAGADO: "Pagado",
};

// Dinámico por depender de la fecha actual; con cacheComponents los datos de
// la BD se leen en cada petición dentro de un límite <Suspense>.
export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  // Primero un acceso a datos de la petición: hoyChile() lee el reloj y no
  // puede ejecutarse durante el prerenderizado.
  const crudo = (await searchParams).mes;
  const hoy = hoyChile();
  const parsed = yearMonth.safeParse(Array.isArray(crudo) ? crudo[0] : crudo);
  const mes = parsed.success ? parsed.data : hoy.slice(0, 7);
  const resumen = await dashboardService.resumenMensual(mes, hoy);
  const pagos = resumen.propiedades.flatMap((p) =>
    p.pagos.map((pago) => ({ ...pago, depto: p.numeroDepartamento }))
  );

  return (
    <>
      <Link href="/" className="text-sm underline">
        ← Inicio
      </Link>
      <div className="my-4 flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Dashboard financiero · {mes}</h1>
        <SelectorMes mes={mes} />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Flujo de caja del mes</h2>
        <ResumenMensual totales={resumen.totales} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Pagos de arriendo del mes contractual</h2>
        {pagos.length === 0 ? (
          <p className="text-sm">Sin pagos esperados para este período.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Depto.</th>
                <th>Estado</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Recibido</th>
                <th className="text-right">Saldo pendiente</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.depto}</td>
                  <td>
                    {ESTADO[p.estado]}
                    {etiquetaCalificacionPago(p) && (
                      <span className="ml-2 text-xs text-gray-600">({etiquetaCalificacionPago(p)})</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">$ {formatearClp(p.montoEsperadoClp)}</td>
                  <td className="text-right tabular-nums">$ {formatearClp(p.recibidoClp)}</td>
                  <td className="text-right tabular-nums">$ {formatearClp(p.saldoPendienteClp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Por propiedad</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Depto.</th>
              <th className="text-right">Ingresos</th>
              <th className="text-right">Egresos</th>
              <th className="text-right">Flujo neto</th>
              <th className="text-right">Saldo crédito (UF)</th>
            </tr>
          </thead>
          <tbody>
            {resumen.propiedades.map((p) => (
              <tr key={p.propiedadId} className="border-b">
                <td className="py-2">
                  <Link href={`/propiedades/${p.propiedadId}?mes=${mes}`} className="underline">
                    {p.numeroDepartamento}
                  </Link>
                </td>
                <td className="text-right tabular-nums">$ {formatearClp(p.ingresosClp)}</td>
                <td className="text-right tabular-nums">$ {formatearClp(p.egresosTotalesClp)}</td>
                <td className="text-right tabular-nums">$ {formatearClp(p.flujoNetoClp)}</td>
                <td className="text-right tabular-nums">
                  {p.saldoCredito
                    ? `${formatearUf(p.saldoCredito.saldoPendienteUf)} (${p.saldoCredito.periodo})`
                    : "Sin saldo registrado"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-gray-600">
        Pendiente de otro ticket: equivalente en CLP del saldo en UF (T10).
      </p>
    </>
  );
}
