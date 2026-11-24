import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { arrendatarioService, propiedadService } from "@/server/services";
import { LoadingState, PageHeader } from "../../../../_ui";
import { ContratoForm } from "../contrato-form";

export default function NuevoContratoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <NuevoContrato params={params} />
    </Suspense>
  );
}

async function NuevoContrato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const arrendatarios = await arrendatarioService.listar();

  return (
    <>
      <PageHeader
        titulo="Nuevo contrato"
        descripcion={`Departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos", href: `/propiedades/${propiedad.id}/contratos` },
          { etiqueta: "Nuevo" },
        ]}
      />
      <ContratoForm propiedadId={propiedad.id} arrendatarios={arrendatarios} />
    </>
  );
}
