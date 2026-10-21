import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { propiedadService } from "@/server/services";
import { PropiedadForm } from "../../propiedad-form";

export default function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <EditarPropiedad params={params} />
      </Suspense>
    </main>
  );
}

async function EditarPropiedad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}`} className="text-sm underline">
        ← Detalle
      </Link>
      <h1 className="my-4 text-2xl font-semibold">Editar departamento {propiedad.numeroDepartamento}</h1>
      <PropiedadForm propiedad={propiedad} />
    </>
  );
}
