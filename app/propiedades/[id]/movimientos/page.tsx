import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { yearMonth } from "@/server/schemas/shared";
import { movimientoService, propiedadService } from "@/server/services";
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
    <main className="mx-auto w-full max-w-4xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Movimientos params={params} searchParams={searchParams} />
      </Suspense>
    </main>
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
  const hoy = hoyChile();
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
      <Link href={`/propiedades/${propiedad.id}`} className="text-sm underline">
        ← Propiedad
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Movimientos financieros · departamento {propiedad.numeroDepartamento}
      </h1>
      <MovimientosPanel propiedadId={propiedad.id} hoy={hoy} mes={mes} listado={listado} />
    </>
  );
}
