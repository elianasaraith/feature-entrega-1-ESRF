import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import { CreditoForm } from "../credito-form";

export default function NuevoCreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <NuevoCredito params={params} />
      </Suspense>
    </main>
  );
}

async function NuevoCredito({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  // Un crédito por propiedad: si ya existe, se edita en lugar de crear.
  const existe = await creditoService
    .obtenerPorPropiedad(id)
    .then(() => true)
    .catch((error) => {
      if (error instanceof NotFoundError) return false;
      throw error;
    });
  if (existe) redirect(`/propiedades/${id}/credito/editar`);

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/credito`} className="text-sm underline">
        ← Crédito hipotecario
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Registrar crédito · departamento {propiedad.numeroDepartamento}
      </h1>
      <CreditoForm propiedadId={propiedad.id} />
    </>
  );
}
