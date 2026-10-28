import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { arrendatarioService, propiedadService } from "@/server/services";
import { ContratoForm } from "../contrato-form";

export default function NuevoContratoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <NuevoContrato params={params} />
      </Suspense>
    </main>
  );
}

async function NuevoContrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const arrendatarios = await arrendatarioService.listar();

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/contratos`} className="text-sm underline">
        ← Contratos
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Nuevo contrato · departamento {propiedad.numeroDepartamento}
      </h1>
      <ContratoForm propiedadId={propiedad.id} arrendatarios={arrendatarios} />
    </>
  );
}
