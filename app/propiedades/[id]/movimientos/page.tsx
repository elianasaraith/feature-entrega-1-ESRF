import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hoyActual } from "../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { yearMonth } from "@/server/schemas/shared";
import { movimientoService, propiedadService } from "@/server/services";
import { LoadingState, PageHeader } from "@/app/_ui";
import { mesLargo } from "@/app/_lib/format";
import { MovimientosPanel } from "./movimientos-panel";

type SearchParams = Promise<{ mes?: string | string[] }>;

export default function MovimientosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Movimientos params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Movimientos({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const hoy = await hoyActual();
  // Mes ausente o inválido → mes actual de Chile.
  const crudo = (await searchParams).mes;
  const parsed = yearMonth.safeParse(Array.isArray(crudo) ? crudo[0] : crudo);
  const mes = parsed.success ? parsed.data : hoy.slice(0, 7);

  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const listado = await movimientoService.listar(id, { mes }).catch(alNoEncontrar);

  return (
    <>
      <PageHeader
        titulo="Movimientos financieros"
        descripcion={`Egresos del departamento ${propiedad.numeroDepartamento} · ${mesLargo(mes)}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Movimientos" },
        ]}
      />
      <MovimientosPanel propiedadId={propiedad.id} hoy={hoy} mes={mes} listado={listado} />
    </>
  );
}
