import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { hoyActual } from "../../../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";
import { fecha } from "../../../../../_lib/format";
import { ButtonLink, LoadingState, PageHeader } from "../../../../../_ui";
import { MontosPanel } from "./montos-panel";

export default function MontosPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Montos params={params} />
    </Suspense>
  );
}

async function Montos({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const referencia = await hoyActual();
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, referencia).catch(alNoEncontrar);
  const { montos, montoVigenteClp } = await contratoService.listarMontos(id, contratoId, referencia);

  return (
    <>
      <PageHeader
        titulo="Montos y reajustes"
        descripcion={`Contrato de ${contrato.arrendatario.nombre} · ${fecha(contrato.fechaInicio)} a ${fecha(contrato.fechaTermino)}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos", href: `/propiedades/${propiedad.id}/contratos` },
          { etiqueta: "Montos" },
        ]}
        acciones={
          <ButtonLink variante="secondary" href={`/propiedades/${propiedad.id}/contratos/${contrato.id}/pagos`}>
            <ReceiptText aria-hidden className="h-4 w-4" />
            Ver pagos y abonos
          </ButtonLink>
        }
      />
      <MontosPanel
        propiedadId={propiedad.id}
        contratoId={contrato.id}
        fechaInicio={contrato.fechaInicio}
        fechaTermino={contrato.fechaTermino}
        montos={montos}
        montoVigenteClp={montoVigenteClp}
      />
    </>
  );
}
