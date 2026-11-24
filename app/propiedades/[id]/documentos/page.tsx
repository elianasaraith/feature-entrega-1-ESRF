import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hoyActual } from "../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { contratoService, creditoService, documentoService, propiedadService } from "@/server/services";
import { fecha } from "../../../_lib/format";
import { LoadingState, PageHeader } from "../../../_ui";
import { DocumentosPanel } from "./documentos-panel";

type Params = Promise<{ id: string }>;

export default function DocumentosPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Documentos params={params} />
    </Suspense>
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
    contratoService.listar(id, await hoyActual()),
    creditoService.obtenerPorPropiedad(id).catch((error) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    }),
  ]);
  return (
    <>
      <PageHeader
        titulo="Documentos"
        descripcion={`Archivos del departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Documentos" },
        ]}
      />
      <DocumentosPanel
        propiedadId={propiedad.id}
        documentos={documentos}
        creditoId={credito?.id ?? null}
        contratos={contratos.map((c) => ({ id: c.id, etiqueta: `${c.arrendatario.nombre} (${fecha(c.fechaInicio)} a ${fecha(c.fechaTermino)})` }))}
      />
    </>
  );
}
