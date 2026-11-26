import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import type { CreditoDto } from "@/server/services/credito-service";
import { CreditoForm } from "../credito-form";
import { Card, CardBody, LoadingState, PageHeader } from "../../../../_ui";

export default function EditarCreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditarCredito params={params} />
    </Suspense>
  );
}

async function EditarCredito({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  let credito: CreditoDto | null = null;
  try {
    credito = await creditoService.obtenerPorPropiedad(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }
  // PUT nunca crea: sin crédito se redirige al alta.
  if (!credito) redirect(`/propiedades/${id}/credito/nuevo`);

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo={`Editar crédito · departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Crédito hipotecario", href: `/propiedades/${propiedad.id}/credito` },
          { etiqueta: "Editar" },
        ]}
      />
      <Card>
        <CardBody>
          <CreditoForm propiedadId={propiedad.id} credito={credito} />
        </CardBody>
      </Card>
    </div>
  );
}
