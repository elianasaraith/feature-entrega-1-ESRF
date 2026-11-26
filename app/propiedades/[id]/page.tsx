import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Pencil, Scale } from "lucide-react";
import { hoyActual } from "../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { yearMonth } from "@/server/schemas/shared";
import { dashboardService, propiedadService } from "@/server/services";
import { clp, fecha, mesLargo, m2, montoMoneda } from "../../_lib/format";
import { ButtonLink, Card, CardBody, CardHeader, DatosLista, LoadingState, PageHeader, StatCard } from "../../_ui";
import { ActividadReciente } from "../../_components/actividad-reciente";
import { ResumenMensual } from "../../_components/resumen-mensual";
import { SelectorMes } from "../../_components/selector-mes";

type SearchParams = Promise<{ mes?: string | string[] }>;

export default function PropiedadDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <DetallePropiedad params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetallePropiedad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  // Mes ausente o inválido → mes actual de Chile. hoyActual() espera la petición real después de leer
  // los parámetros de la petición (acceso dinámico), no durante el prerenderizado.
  const crudo = (await searchParams).mes;
  const hoy = await hoyActual();
  const parsed = yearMonth.safeParse(Array.isArray(crudo) ? crudo[0] : crudo);
  const mes = parsed.success ? parsed.data : hoy.slice(0, 7);
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const p = await propiedadService.obtener(id).catch(alNoEncontrar);
  const resumen = await dashboardService.resumenPropiedad(id, mes, hoy).catch(alNoEncontrar);

  const filas: [string, string][] = [
    ["Número de departamento", p.numeroDepartamento],
    ["Dirección", p.direccion ?? "—"],
    ["Superficie", m2(p.superficieM2)],
    ["Valor de compra", montoMoneda(p.valorCompraMonto, p.valorCompraMoneda)],
    ["Fecha de compra", fecha(p.fechaCompra)],
    ["Estacionamiento", p.estacionamiento ?? "—"],
    ["Bodega", p.bodega ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Departamento ${p.numeroDepartamento}`}
        migas={[{ etiqueta: "Propiedades", href: "/propiedades" }, { etiqueta: `Depto ${p.numeroDepartamento}` }]}
        acciones={
          <ButtonLink href={`/propiedades/${p.id}/editar`} variante="secondary">
            <Pencil aria-hidden className="h-4 w-4" />
            Editar
          </ButtonLink>
        }
      />
      <Card>
        <CardHeader titulo="Ficha de la propiedad" />
        <CardBody>
          <DatosLista filas={filas} />
        </CardBody>
      </Card>
      <section aria-labelledby="resumen-financiero" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="resumen-financiero" className="text-lg font-semibold text-ink">
            Resumen financiero · {mesLargo(mes)}
          </h2>
          <SelectorMes mes={mes} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard etiqueta="Ingresos recibidos" valor={clp(resumen.ingresosClp)} tono="positive" icono={<ArrowUpRight aria-hidden className="h-4 w-4" />} />
          <StatCard etiqueta="Egresos totales" valor={clp(resumen.egresosTotalesClp)} icono={<ArrowDownRight aria-hidden className="h-4 w-4" />} />
          <StatCard
            etiqueta="Flujo neto"
            valor={clp(resumen.flujoNetoClp)}
            tono={resumen.flujoNetoClp.startsWith("-") ? "negative" : resumen.flujoNetoClp === "0" ? "neutral" : "positive"}
            icono={<Scale aria-hidden className="h-4 w-4" />}
          />
        </div>
        <ResumenMensual totales={resumen} />
      </section>
      <section aria-labelledby="actividad-mes" className="space-y-4">
        <h2 id="actividad-mes" className="text-lg font-semibold text-ink">
          Actividad reciente del mes
        </h2>
        <ActividadReciente actividad={resumen.actividad} />
      </section>
    </div>
  );
}
