import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";
import { MontosPanel } from "./montos-panel";

export default function MontosPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Montos params={params} />
      </Suspense>
    </main>
  );
}

async function Montos({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const referencia = hoyChile();
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, referencia).catch(alNoEncontrar);
  const { montos, montoVigenteClp } = await contratoService.listarMontos(id, contratoId, referencia);

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/contratos`} className="text-sm underline">
        ← Contratos
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Montos de arriendo · departamento {propiedad.numeroDepartamento}
      </h1>
      <p className="mb-4 text-sm">
        Contrato de {contrato.arrendatario.nombre}, {contrato.fechaInicio} a {contrato.fechaTermino}.
      </p>
      <MontosPanel
        propiedadId={propiedad.id}
        contratoId={contrato.id}
        fechaInicio={contrato.fechaInicio}
        fechaTermino={contrato.fechaTermino}
        montos={montos}
        montoVigenteClp={montoVigenteClp}
      />
    </>
  );
}
