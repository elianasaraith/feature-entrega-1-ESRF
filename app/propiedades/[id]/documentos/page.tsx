import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { contratoService, creditoService, documentoService, propiedadService } from "@/server/services";
import { DocumentosPanel } from "./documentos-panel";

type Params = Promise<{ id: string }>;

export default function DocumentosPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Documentos params={params} />
      </Suspense>
    </main>
  );
}

async function Documentos({ params }: { params: Params }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const [documentos, contratos, credito] = await Promise.all([
    documentoService.listar(id),
    contratoService.listar(id, hoyChile()),
    creditoService.obtenerPorPropiedad(id).catch((error) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    }),
  ]);
  return (
    <>
      <Link href={`/propiedades/${propiedad.id}`} className="text-sm underline">
        ← Departamento {propiedad.numeroDepartamento}
      </Link>
      <h1 className="my-4 text-2xl font-semibold">Documentos · departamento {propiedad.numeroDepartamento}</h1>
      <DocumentosPanel
        propiedadId={propiedad.id}
        documentos={documentos}
        creditoId={credito?.id ?? null}
        contratos={contratos.map((c) => ({ id: c.id, etiqueta: `${c.arrendatario.nombre} (${c.fechaInicio} a ${c.fechaTermino})` }))}
      />
    </>
  );
}
