import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import { RegistroForm } from "../registro-form";
import { Card, CardBody, LoadingState, PageHeader } from "../../../../../_ui";

export default function NuevoRegistroPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <NuevoRegistro params={params} />
    </Suspense>
  );
}

async function NuevoRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  // Sin crédito no hay registro mensual: se redirige al alta del crédito.
  await creditoService.obtenerPorPropiedad(id).catch((error) => {
    if (error instanceof NotFoundError) redirect(`/propiedades/${id}/credito/nuevo`);
    throw error;
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo={`Registrar mes · departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Crédito hipotecario", href: `/propiedades/${propiedad.id}/credito` },
          { etiqueta: "Registro mensual", href: `/propiedades/${propiedad.id}/credito/registro-mensual` },
          { etiqueta: "Registrar mes" },
        ]}
      />
      <Card>
        <CardBody>
          <RegistroForm propiedadId={propiedad.id} />
        </CardBody>
      </Card>
    </div>
  );
}
