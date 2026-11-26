import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { propiedadService } from "@/server/services";
import { Card, CardBody, LoadingState, PageHeader } from "../../../_ui";
import { PropiedadForm } from "../../propiedad-form";

export default function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditarPropiedad params={params} />
    </Suspense>
  );
}

async function EditarPropiedad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo={`Editar departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Editar" },
        ]}
      />
      <Card>
        <CardBody>
          <PropiedadForm propiedad={propiedad} />
        </CardBody>
      </Card>
    </div>
  );
}
