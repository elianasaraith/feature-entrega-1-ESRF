import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";
import { ArrendatarioForm } from "./arrendatario-form";

type Params = Promise<{ id: string; contratoId: string }>;

export default function EditarArrendatarioPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <EditarArrendatario params={params} />
      </Suspense>
    </main>
  );
}

async function EditarArrendatario({ params }: { params: Params }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, hoyChile()).catch(alNoEncontrar);
  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/contratos`} className="text-sm underline">
        ← Contratos
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Editar arrendatario · departamento {propiedad.numeroDepartamento}
      </h1>
      <ArrendatarioForm propiedadId={propiedad.id} arrendatario={contrato.arrendatario} />
    </>
  );
}
