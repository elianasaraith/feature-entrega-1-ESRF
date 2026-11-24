import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import { CreditoForm } from "../credito-form";
import { Card, CardBody, LoadingState, PageHeader } from "../../../../_ui";

export default function NuevoCreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <NuevoCredito params={params} />
    </Suspense>
  );
}

async function NuevoCredito({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  // Un crédito por propiedad: si ya existe, se edita en lugar de crear.
  const existe = await creditoService
    .obtenerPorPropiedad(id)
    .then(() => true)
    .catch((error) => {
      if (error instanceof NotFoundError) return false;
      throw error;
    });
  if (existe) redirect(`/propiedades/${id}/credito/editar`);

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo={`Registrar crédito · departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Crédito hipotecario", href: `/propiedades/${propiedad.id}/credito` },
          { etiqueta: "Registrar" },
        ]}
      />
      <Card>
        <CardBody>
          <CreditoForm propiedadId={propiedad.id} />
        </CardBody>
      </Card>
    </div>
  );
}
