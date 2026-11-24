import { Suspense } from "react";
import { Building2, Plus } from "lucide-react";
import { propiedadService } from "@/server/services";
import { fecha, m2, montoMoneda } from "../_lib/format";
import { ButtonLink, Card, EmptyState, LoadingState, PageHeader } from "../_ui";

// Con cacheComponents los datos de la BD se leen en cada petición y deben
// quedar dentro de un límite <Suspense>.
export default function PropiedadesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ListadoPropiedades />
    </Suspense>
  );
}

async function ListadoPropiedades() {
  const propiedades = await propiedadService.listar();

  const nueva = (
    <ButtonLink href="/propiedades/nueva">
      <Plus aria-hidden className="h-4 w-4" />
      Nueva propiedad
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        titulo="Propiedades"
        descripcion="Cartera de departamentos registrados."
        acciones={propiedades.length > 0 ? nueva : undefined}
      />
      {propiedades.length === 0 ? (
        <Card>
          <EmptyState
            titulo="No hay propiedades registradas"
            descripcion="Registre su primera propiedad para comenzar a gestionar créditos, contratos y movimientos."
            accion={nueva}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {propiedades.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start gap-3 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                    <Building2 aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink">Departamento {p.numeroDepartamento}</h2>
                    <p className="text-sm text-muted">{m2(p.superficieM2)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 px-5 pb-4 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Valor de compra</dt>
                    <dd className="mt-0.5 break-words tabular-nums text-ink">
                      {montoMoneda(p.valorCompraMonto, p.valorCompraMoneda)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Fecha de compra</dt>
                    <dd className="mt-0.5 text-ink">{fecha(p.fechaCompra)}</dd>
                  </div>
                  {p.estacionamiento && (
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Estacionamiento</dt>
                      <dd className="mt-0.5 break-words text-ink">{p.estacionamiento}</dd>
                    </div>
                  )}
                  {p.bodega && (
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Bodega</dt>
                      <dd className="mt-0.5 break-words text-ink">{p.bodega}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-line px-5 py-3">
                  <ButtonLink href={`/propiedades/${p.id}`} tamano="sm">
                    Ver detalle
                  </ButtonLink>
                  <ButtonLink href={`/propiedades/${p.id}/credito`} tamano="sm" variante="secondary">
                    Crédito
                  </ButtonLink>
                  <ButtonLink href={`/propiedades/${p.id}/contratos`} tamano="sm" variante="secondary">
                    Contratos
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
