import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { propiedadService } from "@/server/services";

export default function PropiedadDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <DetallePropiedad params={params} />
      </Suspense>
    </main>
  );
}

async function DetallePropiedad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

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
      <Link href={`/propiedades/${p.id}/credito`} className="mt-6 inline-block text-sm underline">
        Crédito hipotecario
      </Link>
      <Link href={`/propiedades/${p.id}/contratos`} className="mt-2 block text-sm underline">
        Contratos de arriendo
      </Link>
    </>
  );
}
