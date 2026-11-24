import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Banknote } from "lucide-react";
import { hoyActual } from "../../../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { contratoService, pagoService, propiedadService } from "@/server/services";
import { fecha } from "../../../../../_lib/format";
import { ButtonLink, LoadingState, PageHeader } from "../../../../../_ui";
import { PagosPanel } from "./pagos-panel";

export default function PagosPage({
  params,
}: {
  params: Promise<{ id: string; contratoId: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Pagos params={params} />
    </Suspense>
  );
}

async function Pagos({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  const alNoEncontrar = (error: unknown): never => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  };
  const hoy = await hoyActual();
  const propiedad = await propiedadService.obtener(id).catch(alNoEncontrar);
  const contrato = await contratoService.obtener(id, contratoId, hoy).catch(alNoEncontrar);
  const pagos = await pagoService.listarPagos(id, contratoId, hoy).catch(alNoEncontrar);

  return (
    <>
      <PageHeader
        titulo="Pagos y abonos"
        descripcion={`Contrato de ${contrato.arrendatario.nombre} · ${fecha(contrato.fechaInicio)} a ${fecha(contrato.fechaTermino)}. Si faltan meses, créelos con «Sincronizar pagos esperados» en Montos.`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos", href: `/propiedades/${propiedad.id}/contratos` },
          { etiqueta: "Pagos" },
        ]}
        acciones={
          <ButtonLink variante="secondary" href={`/propiedades/${propiedad.id}/contratos/${contrato.id}/montos`}>
            <Banknote aria-hidden className="h-4 w-4" />
            Montos y reajustes
          </ButtonLink>
        }
      />
      <PagosPanel propiedadId={propiedad.id} contratoId={contrato.id} hoy={hoy} pagos={pagos} />
    </>
  );
}
