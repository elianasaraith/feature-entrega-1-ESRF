import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoRegistroService, propiedadService } from "@/server/services";
import type {
  RegistroMensualConEquivalenteDto,
  RegistroMensualDto,
} from "@/server/services/credito-registro-service";
import { formatearMontoClp, formatearValorUf } from "@/server/uf/equivalente";
import { fecha, uf, clp } from "../../../../_lib/format";
import { ButtonLink, Card, DataTable, EmptyState, LoadingState, PageHeader, Td, Th } from "../../../../_ui";

export default function RegistroMensualPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Historial params={params} />
    </Suspense>
  );
}

const NO_REGISTRADO = "No registrado";
const CLP_NO_DISPONIBLE = "No disponible";

// Rótulo derivado, no almacenado: solo si el mes de caja difiere del período.
function correspondiente(r: RegistroMensualDto): string | null {
  if (!r.fechaPagoDividendo || r.fechaPagoDividendo.slice(0, 7) === r.periodo) return null;
  return `Correspondiente a ${r.periodo}`;
}

async function Historial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  let registros: RegistroMensualConEquivalenteDto[] | null = null;
  try {
    registros = await creditoRegistroService.listarConEquivalentes(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  const migas = [
    { etiqueta: "Propiedades", href: "/propiedades" },
    { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
    { etiqueta: "Crédito hipotecario", href: `/propiedades/${propiedad.id}/credito` },
    { etiqueta: "Registro mensual" },
  ];

  if (!registros) {
    return (
      <>
        <PageHeader titulo="Registro mensual" migas={migas} />
        <Card>
          <EmptyState
            titulo="Sin crédito registrado"
            descripcion="Esta propiedad no tiene crédito hipotecario: registre el crédito para llevar su registro mensual."
            accion={<ButtonLink href={`/propiedades/${propiedad.id}/credito/nuevo`}>Registrar crédito</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const nuevo = (
    <ButtonLink href={`/propiedades/${propiedad.id}/credito/registro-mensual/nuevo`}>Registrar mes</ButtonLink>
  );

  return (
    <>
      <PageHeader
        titulo={`Registro mensual · departamento ${propiedad.numeroDepartamento}`}
        migas={migas}
        acciones={registros.length > 0 ? nuevo : undefined}
      />
      <Card>
        {registros.length === 0 ? (
          <EmptyState titulo={NO_REGISTRADO} descripcion="Aún no hay meses registrados." accion={nuevo} />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Período</Th>
                <Th alinear="right">Dividendo pagado (CLP)</Th>
                <Th>Fecha de pago</Th>
                <Th alinear="right">Saldo pendiente (UF)</Th>
                <Th>
                  <span className="sr-only">Acciones</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.periodo} className="align-top">
                  <Td className="font-medium text-ink">{r.periodo}</Td>
                  <Td numerico>{r.dividendoPagadoClp ? clp(r.dividendoPagadoClp) : NO_REGISTRADO}</Td>
                  <Td>
                    {r.fechaPagoDividendo ? fecha(r.fechaPagoDividendo) : NO_REGISTRADO}
                    {correspondiente(r) && <span className="block text-xs text-muted">{correspondiente(r)}</span>}
                  </Td>
                  <Td numerico>
                    {r.saldoPendienteUf ? (
                      <>
                        {uf(r.saldoPendienteUf)}
                        {r.equivalenteClp ? (
                          <>
                            <span className="block text-xs">CLP: {formatearMontoClp(r.equivalenteClp)}</span>
                            <span className="block text-xs text-muted">
                              {formatearValorUf(r.equivalenteClp)} · {r.equivalenteClp.fechaReferencia}
                            </span>
                          </>
                        ) : (
                          <span className="block text-xs">CLP: {CLP_NO_DISPONIBLE}</span>
                        )}
                      </>
                    ) : (
                      NO_REGISTRADO
                    )}
                  </Td>
                  <Td>
                    <ButtonLink
                      href={`/propiedades/${propiedad.id}/credito/registro-mensual/${r.periodo}/editar`}
                      variante="secondary"
                      tamano="sm"
                    >
                      Editar
                    </ButtonLink>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </>
  );
}
