import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { periodoSchema } from "@/server/schemas/credito-registro";
import { creditoRegistroService, propiedadService } from "@/server/services";
import { RegistroForm } from "../../registro-form";
import { Card, CardBody, LoadingState, PageHeader } from "../../../../../../_ui";

export default function EditarRegistroPage({
  params,
}: {
  params: Promise<{ id: string; periodo: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <EditarRegistro params={params} />
    </Suspense>
  );
}

async function EditarRegistro({ params }: { params: Promise<{ id: string; periodo: string }> }) {
  const { id, periodo } = await params;
  const valido = periodoSchema.safeParse(periodo);
  if (!valido.success) notFound();

  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const registro = await creditoRegistroService
    .obtenerPorPeriodo(id, valido.data)
    .catch((error) => {
      if (error instanceof NotFoundError) redirect(`/propiedades/${id}/credito/nuevo`);
      throw error;
    });
  // PUT nunca crea: un mes sin registro se da de alta, no se edita.
  if (!registro.registrado) redirect(`/propiedades/${id}/credito/registro-mensual/nuevo`);

  return (
    <div className="max-w-2xl">
      <PageHeader
        titulo={`Editar ${registro.periodo} · departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Crédito hipotecario", href: `/propiedades/${propiedad.id}/credito` },
          { etiqueta: "Registro mensual", href: `/propiedades/${propiedad.id}/credito/registro-mensual` },
          { etiqueta: `Editar ${registro.periodo}` },
        ]}
      />
      <Card>
        <CardBody>
          <RegistroForm propiedadId={propiedad.id} registro={registro} />
        </CardBody>
      </Card>
    </div>
  );
}
