import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { hoyActual } from "../../../_lib/hoy";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";
import { fecha } from "../../../_lib/format";
import { Badge, ButtonLink, Card, DatosLista, EmptyState, LoadingState, PageHeader } from "../../../_ui";
import type { TonoBadge } from "../../../_ui";

export default function ContratosPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Contratos params={params} />
    </Suspense>
  );
}

const VIGENCIA: Record<string, string> = {
  FUTURO: "Futuro",
  VIGENTE: "Vigente",
  FINALIZADO: "Finalizado",
};
const TONO_VIGENCIA: Record<string, TonoBadge> = {
  FUTURO: "info",
  VIGENTE: "positive",
  FINALIZADO: "neutral",
};

async function Contratos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const contratos = await contratoService.listar(id, await hoyActual());
  const base = `/propiedades/${propiedad.id}/contratos`;

  return (
    <>
      <PageHeader
        titulo="Contratos"
        descripcion={`Departamento ${propiedad.numeroDepartamento}`}
        migas={[
          { etiqueta: "Propiedades", href: "/propiedades" },
          { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
          { etiqueta: "Contratos" },
        ]}
        acciones={
          <ButtonLink href={`${base}/nuevo`}>
            <Plus aria-hidden className="h-4 w-4" />
            Nuevo contrato
          </ButtonLink>
        }
      />
      {contratos.length === 0 ? (
        <Card>
          <EmptyState
            titulo="Esta propiedad aún no tiene contratos"
            descripcion="Registre el primer contrato de arriendo para comenzar a controlar los pagos."
            accion={<ButtonLink href={`${base}/nuevo`}>Nuevo contrato</ButtonLink>}
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {contratos.map((c) => (
            <li key={c.id}>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-ink">{c.arrendatario.nombre}</h2>
                  <Badge tono={TONO_VIGENCIA[c.vigencia] ?? "neutral"}>{VIGENCIA[c.vigencia] ?? c.vigencia}</Badge>
                </div>
                <DatosLista
                  filas={[
                    ["Vigencia", `${fecha(c.fechaInicio)} a ${fecha(c.fechaTermino)}`],
                    ["Día de pago", c.diaEsperadoPago],
                    ["Monto inicial (CLP)", c.montoInicialClp ?? "Sin monto registrado"],
                    ["Garantía (contractual)", c.garantiaClp ?? "—"],
                    ["RUT", c.arrendatario.rut ?? "—"],
                    ["Contacto", [c.arrendatario.email, c.arrendatario.telefono].filter(Boolean).join(" · ") || "—"],
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <ButtonLink variante="secondary" tamano="sm" href={`${base}/${c.id}/pagos`}>
                    Pagos
                  </ButtonLink>
                  <ButtonLink variante="secondary" tamano="sm" href={`${base}/${c.id}/montos`}>
                    Montos
                  </ButtonLink>
                  <ButtonLink variante="ghost" tamano="sm" href={`${base}/${c.id}/editar`}>
                    Editar
                  </ButtonLink>
                  <ButtonLink variante="ghost" tamano="sm" href={`${base}/${c.id}/arrendatario/editar`}>
                    Editar arrendatario
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
