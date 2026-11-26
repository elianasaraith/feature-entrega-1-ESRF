import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { hoyActual } from "../_lib/hoy";
import { etiquetaCalificacionPago, mesAdyacente } from "@/server/domain/dashboard";
import { MESES_HISTORICO_DEFECTO, mesesHistorico, yearMonth } from "@/server/schemas/shared";
import { dashboardService } from "@/server/services";
import { etiquetaMes, formatearMontoClp, formatearValorUf, referenciasUf } from "@/server/uf/equivalente";
import { HistoricoGraficos } from "../_components/historico-graficos";
import { HistoricoMensual } from "../_components/historico-mensual";
import { SaldoConsolidado } from "../_components/saldo-consolidado";
import { SelectorMes } from "../_components/selector-mes";
import { clp, mesLargo, uf } from "../_lib/format";
import { cn } from "../_lib/cn";
import { Alert, BadgeEstadoPago, ButtonLink, Card, CardBody, CardHeader, DataTable, EmptyState, LoadingState, PageHeader, StatCard, Td, Th } from "../_ui";

type SearchParams = Promise<{ mes?: string | string[]; meses?: string | string[] }>;

// Dinámico por depender de la fecha actual; con cacheComponents los datos de
// la BD se leen en cada petición dentro de un límite <Suspense>.
export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoadingState texto="Cargando dashboard…" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  // Primero un acceso a datos de la petición: await hoyActual() lee el reloj y no
  // puede ejecutarse durante el prerenderizado.
  const crudo = (await searchParams).mes;
  const hoy = await hoyActual();
  const parsed = yearMonth.safeParse(Array.isArray(crudo) ? crudo[0] : crudo);
  const mes = parsed.success ? parsed.data : hoy.slice(0, 7);
  const crudoMeses = (await searchParams).meses;
  const parsedMeses = mesesHistorico.safeParse(Array.isArray(crudoMeses) ? crudoMeses[0] : crudoMeses);
  const meses = parsedMeses.success ? parsedMeses.data : MESES_HISTORICO_DEFECTO;
  const [resumen, historico] = await Promise.all([
    dashboardService.resumenMensualConEquivalentes(mes, hoy),
    dashboardService.historico(mes, meses),
  ]);
  const sufijoMeses = meses === MESES_HISTORICO_DEFECTO ? "" : `&meses=${meses}`;
  // Única referencia compartida: todos los saldos se convierten con la UF del mes
  // consultado. Solo existe si alguna UF se utilizó efectivamente.
  const referencia = referenciasUf(resumen.propiedades.map((p) => p.saldoCredito?.equivalenteClp ?? null))[0] ?? null;
  const pagos = resumen.propiedades.flatMap((p) => p.pagos.map((pago) => ({ ...pago, depto: p.numeroDepartamento })));
  const { totales } = resumen;
  const neto = totales.flujoNetoClp;
  const tonoNeto = neto.startsWith("-") ? "negative" : neto === "0" ? "neutral" : "positive";

  return (
    <>
      <PageHeader
        titulo="Dashboard financiero"
        descripcion={<span className="capitalize">{mesLargo(mes)}</span>}
        acciones={<SelectorMes mes={mes} meses={meses === MESES_HISTORICO_DEFECTO ? undefined : meses} />}
      />
      <nav aria-label="Navegación de mes" className="-mt-2 mb-6 flex gap-2">
        <ButtonLink href={`?mes=${mesAdyacente(mes, -1)}${sufijoMeses}`} variante="secondary" tamano="sm">
          <ChevronLeft aria-hidden className="h-4 w-4" /> Mes anterior
        </ButtonLink>
        <ButtonLink href={`?mes=${mesAdyacente(mes, 1)}${sufijoMeses}`} variante="secondary" tamano="sm">
          Mes siguiente <ChevronRight aria-hidden className="h-4 w-4" />
        </ButtonLink>
      </nav>

      <section aria-label="Resumen del mes" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          etiqueta="Ingresos recibidos"
          valor={clp(totales.ingresosClp)}
          tono="positive"
          icono={<ArrowUpRight aria-hidden className="h-4 w-4" />}
          detalle="Arriendos cobrados en el mes"
        />
        <StatCard
          etiqueta="Egresos"
          valor={clp(totales.egresosTotalesClp)}
          icono={<ArrowDownRight aria-hidden className="h-4 w-4" />}
          detalle={`Dividendos ${clp(totales.dividendosClp)} · Otros ${clp(totales.otrosEgresosClp)}`}
        />
        <StatCard
          etiqueta="Flujo neto"
          valor={clp(neto)}
          tono={tonoNeto}
          icono={<Scale aria-hidden className="h-4 w-4" />}
          detalle="Ingresos menos egresos"
        />
        <SaldoConsolidado saldo={resumen.saldoConsolidado} />
      </section>

      <Card className="mt-6">
        <CardHeader
          titulo={`Histórico de los últimos ${meses} meses`}
          acciones={
            <div role="group" aria-label="Período del histórico" className="flex gap-1 rounded-lg bg-canvas p-1 text-sm">
              {[6, 12].map((n) => (
                <Link
                  key={n}
                  href={`?mes=${mes}${n === MESES_HISTORICO_DEFECTO ? "" : `&meses=${n}`}`}
                  aria-current={meses === n ? "true" : undefined}
                  className={cn("rounded-md px-3 py-1 font-medium", meses === n ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink")}
                >
                  {n} meses
                </Link>
              ))}
            </div>
          }
        />
        <CardBody>
          <HistoricoGraficos periodos={historico.periodos} />
        </CardBody>
        <HistoricoMensual periodos={historico.periodos} />
      </Card>

      <Card className="mt-6">
        <CardHeader titulo="Resumen por propiedad" descripcion={<span className="capitalize">{mesLargo(mes)}</span>} />
        {resumen.propiedades.length === 0 ? (
          <EmptyState titulo="Sin propiedades" descripcion="Registra una propiedad para ver su resumen financiero." accion={<ButtonLink href="/propiedades/nueva">Nueva propiedad</ButtonLink>} />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Depto.</Th>
                <Th alinear="right">Ingresos</Th>
                <Th alinear="right">Egresos</Th>
                <Th alinear="right">Flujo neto</Th>
                <Th alinear="right">Saldo crédito</Th>
              </tr>
            </thead>
            <tbody>
              {resumen.propiedades.map((p) => (
                <tr key={p.propiedadId}>
                  <Td>
                    <Link href={`/propiedades/${p.propiedadId}?mes=${mes}`} className="font-medium text-brand hover:underline">
                      {p.numeroDepartamento}
                    </Link>
                  </Td>
                  <Td numerico>{clp(p.ingresosClp)}</Td>
                  <Td numerico>{clp(p.egresosTotalesClp)}</Td>
                  <Td numerico className={cn("font-medium", p.flujoNetoClp.startsWith("-") && "text-negative")}>
                    {clp(p.flujoNetoClp)}
                  </Td>
                  <Td numerico>
                    {p.saldoCredito ? (
                      <>
                        {uf(p.saldoCredito.saldoPendienteUf)}
                        <span className="block text-xs text-muted">
                          Período {p.saldoCredito.periodo} · CLP:{" "}
                          {p.saldoCredito.equivalenteClp ? formatearMontoClp(p.saldoCredito.equivalenteClp) : "No disponible"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Sin saldo registrado</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader titulo="Pagos de arriendo del mes contractual" />
        {pagos.length === 0 ? (
          <EmptyState titulo="Sin pagos esperados" descripcion="No hay pagos esperados para este período." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Depto.</Th>
                <Th>Estado</Th>
                <Th alinear="right">Esperado</Th>
                <Th alinear="right">Recibido</Th>
                <Th alinear="right">Saldo pendiente</Th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const calificacion = etiquetaCalificacionPago(p);
                return (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.depto}</Td>
                    <Td>
                      <BadgeEstadoPago estado={p.estado} />
                      {calificacion && <span className="ml-2 text-xs text-muted">({calificacion})</span>}
                    </Td>
                    <Td numerico>{clp(p.montoEsperadoClp)}</Td>
                    <Td numerico>{clp(p.recibidoClp)}</Td>
                    <Td numerico>{clp(p.saldoPendienteClp)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>

      {referencia && (
        <Alert tono="info" className="mt-6">
          Equivalentes en CLP calculados con la UF de {etiquetaMes(`${mes}-01`)}: {formatearValorUf(referencia)} · referencia{" "}
          {referencia.fechaReferencia}. El período de cada saldo puede ser anterior al mes usado para la conversión.
        </Alert>
      )}
    </>
  );
}
