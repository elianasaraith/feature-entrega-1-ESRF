import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { contratoService, pagoService, propiedadService } from "@/server/services";
import { PagosPanel } from "./pagos-panel";

export default function PagosPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Pagos params={params} />
      </Suspense>
    </main>
  );
}

async function Pagos({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const hoy = hoyChile();
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, hoy).catch(alNoEncontrar);
  const pagos = await pagoService.listarPagos(id, contratoId, hoy).catch(alNoEncontrar);

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}/contratos`} className="text-sm underline">
        ← Contratos
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Pagos de arriendo · departamento {propiedad.numeroDepartamento}
      </h1>
      <p className="mb-4 text-sm">
        Contrato de {contrato.arrendatario.nombre}, {contrato.fechaInicio} a {contrato.fechaTermino}.
        Si faltan meses, créelos con «Sincronizar pagos esperados» en{" "}
        <Link
          href={`/propiedades/${propiedad.id}/contratos/${contrato.id}/montos`}
          className="underline"
        >
          Montos
        </Link>
        .
      </p>
      <PagosPanel propiedadId={propiedad.id} contratoId={contrato.id} hoy={hoy} pagos={pagos} />
    </>
  );
}
