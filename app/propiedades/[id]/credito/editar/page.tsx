import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import type { CreditoDto } from "@/server/services/credito-service";
import { CreditoForm } from "../credito-form";

export default function EditarCreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <EditarCredito params={params} />
      </Suspense>
    </main>
  );
}

async function EditarCredito({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  let credito: CreditoDto | null = null;
  try {
    credito = await creditoService.obtenerPorPropiedad(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }
  // PUT nunca crea: sin crédito se redirige al alta.
  if (!credito) redirect(`/propiedades/${id}/credito/nuevo`);

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/credito`} className="text-sm underline">
        ← Crédito hipotecario
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Editar crédito · departamento {propiedad.numeroDepartamento}
      </h1>
      <CreditoForm propiedadId={propiedad.id} credito={credito} />
    </>
  );
}
