import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import { RegistroForm } from "../registro-form";

export default function NuevoRegistroPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <NuevoRegistro params={params} />
      </Suspense>
    </main>
  );
}

async function NuevoRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  // Sin crédito no hay registro mensual: se redirige al alta del crédito.
  await creditoService.obtenerPorPropiedad(id).catch((error) => {
    if (error instanceof NotFoundError) redirect(`/propiedades/${id}/credito/nuevo`);
    throw error;
  });

  return (
    <>
      <Link
        href={`/propiedades/${propiedad.id}/credito/registro-mensual`}
        className="text-sm underline"
      >
        ← Registro mensual
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Registrar mes · departamento {propiedad.numeroDepartamento}
      </h1>
      <RegistroForm propiedadId={propiedad.id} />
    </>
  );
}
