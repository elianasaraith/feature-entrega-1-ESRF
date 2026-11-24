import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hoyActual } from "../../../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { arrendatarioService, contratoService, propiedadService } from "@/server/services";
import { LoadingState, PageHeader } from "../../../../../_ui";
import { ContratoForm } from "../../contrato-form";

export default function EditarContratoPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditarContrato params={params} />
    </Suspense>
  );
}

async function EditarContrato({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, await hoyActual()).catch(alNoEncontrar);
  const arrendatarios = await arrendatarioService.listar();

  return (
    <>
      <PageHeader
        titulo="Editar contrato"
        descripcion={`Departamento ${propiedad.numeroDepartamento} · ${contrato.arrendatario.nombre}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos", href: `/propiedades/${propiedad.id}/contratos` },
          { etiqueta: "Editar" },
        ]}
      />
      <ContratoForm propiedadId={propiedad.id} arrendatarios={arrendatarios} contrato={contrato} />
    </>
  );
}
