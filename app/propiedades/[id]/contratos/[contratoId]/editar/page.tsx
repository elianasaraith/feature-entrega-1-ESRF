import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { arrendatarioService, contratoService, propiedadService } from "@/server/services";
import { ContratoForm } from "../../contrato-form";

export default function EditarContratoPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <EditarContrato params={params} />
      </Suspense>
    </main>
  );
}

async function EditarContrato({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, hoyChile()).catch(alNoEncontrar);
  const arrendatarios = await arrendatarioService.listar();

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/contratos`} className="text-sm underline">
        ← Contratos
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Editar contrato · departamento {propiedad.numeroDepartamento}
      </h1>
      <ContratoForm propiedadId={propiedad.id} arrendatarios={arrendatarios} contrato={contrato} />
    </>
  );
}
