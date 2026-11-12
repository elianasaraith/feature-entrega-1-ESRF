import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { yearMonth } from "@/server/schemas/shared";
import { dashboardService, propiedadService } from "@/server/services";
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
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <DetallePropiedad params={params} searchParams={searchParams} />
      </Suspense>
    </main>
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
  // Mes ausente o inválido → mes actual de Chile. hoyChile() va después de leer
  // los parámetros de la petición (acceso dinámico), no durante el prerenderizado.
  const crudo = (await searchParams).mes;
  const hoy = hoyChile();
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
    ["Superficie", `${p.superficieM2} m²`],
    ["Valor de compra", `${p.valorCompraMonto} ${p.valorCompraMoneda}`],
    ["Fecha de compra", p.fechaCompra],
    ["Estacionamiento", p.estacionamiento ?? "—"],
    ["Bodega", p.bodega ?? "—"],
  ];

  return (
    <>
      <Link href="/propiedades" className="text-sm underline">
        ← Propiedades
      </Link>
      <div className="my-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Departamento {p.numeroDepartamento}</h1>
        <Link href={`/propiedades/${p.id}/editar`} className="rounded bg-black px-3 py-2 text-sm text-white">
          Editar
        </Link>
      </div>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-2 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents">
            <dt className="font-medium">{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Resumen financiero · {mes}</h2>
          <SelectorMes mes={mes} />
        </div>
        <ResumenMensual totales={resumen} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Actividad reciente del mes</h2>
        <ActividadReciente actividad={resumen.actividad} />
      </section>
      <Link href={`/propiedades/${p.id}/credito`} className="mt-8 inline-block text-sm underline">
        Crédito hipotecario
      </Link>
      <Link href={`/propiedades/${p.id}/contratos`} className="mt-2 block text-sm underline">
        Contratos de arriendo
      </Link>
      <Link href={`/propiedades/${p.id}/movimientos`} className="mt-2 block text-sm underline">
        Movimientos financieros
      </Link>
    </>
  );
}
