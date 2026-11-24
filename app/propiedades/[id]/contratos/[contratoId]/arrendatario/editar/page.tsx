import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hoyActual } from "../../../../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";
import { Card, CardBody, LoadingState, PageHeader } from "../../../../../../_ui";
import { ArrendatarioForm } from "./arrendatario-form";

type Params = Promise<{ id: string; contratoId: string }>;

export default function EditarArrendatarioPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditarArrendatario params={params} />
    </Suspense>
  );
}

async function EditarArrendatario({ params }: { params: Params }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, await hoyActual()).catch(alNoEncontrar);
  return (
    <>
      <PageHeader
        titulo="Editar arrendatario"
        descripcion={`Departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos", href: `/propiedades/${propiedad.id}/contratos` },
          { etiqueta: "Editar arrendatario" },
        ]}
      />
      <Card className="max-w-2xl">
        <CardBody>
          <ArrendatarioForm propiedadId={propiedad.id} arrendatario={contrato.arrendatario} />
        </CardBody>
      </Card>
    </>
  );
}
