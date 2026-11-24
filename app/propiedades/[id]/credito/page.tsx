import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import type { CreditoConEquivalentesDto } from "@/server/services/credito-service";
import {
  etiquetaMes,
  formatearMontoClp,
  formatearValorUf,
  referenciasUf,
} from "@/server/uf/equivalente";
import type { EquivalenteClpDto } from "@/server/uf/equivalente";
import { clp, fecha, porcentaje, uf } from "../../../_lib/format";
import { BarraPie } from "./barra-pie";
import { ButtonLink, Card, CardBody, CardHeader, DatosLista, EmptyState, LoadingState, PageHeader } from "../../../_ui";

export default function CreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <DetalleCredito params={params} />
    </Suspense>
  );
}

const CLP_NO_DISPONIBLE = "No disponible";

// El equivalente ya viene calculado por el servidor; aquí solo se presenta. La UF
// utilizada se muestra una sola vez en «Valores de UF utilizados»; junto al monto
// solo se indica el mes cuando hay más de una referencia que distinguir.
function textoClp(
  equivalente: EquivalenteClpDto,
  variasReferencias: boolean,
  sinReferencia?: string
): string {
  if (!equivalente) return `CLP: ${sinReferencia ?? CLP_NO_DISPONIBLE}`;
  const mes = variasReferencias ? ` · ${etiquetaMes(equivalente.fechaReferencia, true)}` : "";
  return `CLP: ${formatearMontoClp(equivalente)}${mes}`;
}

async function DetalleCredito({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  let credito: CreditoConEquivalentesDto | null = null;
  try {
    credito = await creditoService.obtenerConEquivalentes(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  const migas = [
    { etiqueta: "Propiedades", href: "/propiedades" },
    { etiqueta: `Depto ${propiedad.numeroDepartamento}`, href: `/propiedades/${propiedad.id}` },
    { etiqueta: "Crédito hipotecario" },
  ];

  if (!credito) {
    return (
      <>
        <PageHeader titulo="Crédito hipotecario" migas={migas} />
        <Card>
          <EmptyState
            titulo="Sin crédito registrado"
            descripcion="Esta propiedad no tiene crédito hipotecario registrado."
            accion={<ButtonLink href={`/propiedades/${propiedad.id}/credito/nuevo`}>Registrar crédito</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  // Registro de período máximo con saldo; no es un saldo calculado ni «actual».
  const ultimoSaldo = credito.ultimoSaldo;

  const referencias = referenciasUf([
    credito.cuotaContractualClp,
    credito.saldoInicialClp,
    ultimoSaldo?.equivalenteClp ?? null,
  ]);
  const varias = referencias.length > 1;

  const filas: [string, string][] = [
    ["Banco", credito.banco],
    ["Cuota contractual", `${uf(credito.cuotaContractualUf)} · ${textoClp(credito.cuotaContractualClp, varias)}`],
    [
      "Saldo inicial",
      credito.saldoInicialUf
        ? `${uf(credito.saldoInicialUf)} · ${textoClp(
            credito.saldoInicialClp,
            varias,
            credito.fechaOtorgamiento === null ? "Sin fecha de otorgamiento" : undefined
          )}`
        : "—",
    ],
    [
      "Último saldo registrado",
      ultimoSaldo
        ? `${uf(ultimoSaldo.saldoPendienteUf)} (período ${ultimoSaldo.periodo}) · ${textoClp(ultimoSaldo.equivalenteClp, varias)}`
        : "No registrado",
    ],
    ["Tasa de interés anual", porcentaje(credito.tasaInteresAnual)],
    ["Número total de cuotas", String(credito.numeroCuotasTotal)],
    ["Día de vencimiento", String(credito.diaVencimiento)],
    ["Seguros", credito.segurosUf ? uf(credito.segurosUf) : "—"],
    ["Monto original", credito.montoOriginalUf ? uf(credito.montoOriginalUf) : "—"],
    ["Porcentaje de pie", credito.porcentajePie === null ? "No informado" : porcentaje(credito.porcentajePie)],
    ["Número de crédito", credito.numeroCredito ?? "—"],
    ["Fecha de otorgamiento", credito.fechaOtorgamiento ? fecha(credito.fechaOtorgamiento) : "—"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Crédito hipotecario"
        migas={migas}
        acciones={
          <>
            <ButtonLink href={`/propiedades/${propiedad.id}/credito/registro-mensual`} variante="secondary">
              Registro mensual
            </ButtonLink>
            <ButtonLink href={`/propiedades/${propiedad.id}/credito/editar`}>Editar</ButtonLink>
          </>
        }
      />
      <Card>
        <CardHeader titulo="Resumen del crédito" descripcion="Montos en UF con su equivalente en CLP." />
        <CardBody>
          <DatosLista filas={filas} />
        </CardBody>
      </Card>
      {credito.porcentajePie !== null && credito.pieEstimado && (
        <Card>
          <CardHeader
            titulo="Pie sobre el valor de compra"
            descripcion="Dato informado; no corresponde al porcentaje financiado por el banco."
          />
          <CardBody className="space-y-4">
            <p className="text-sm text-ink">
              Monto estimado del pie:{" "}
              <span className="font-semibold tabular-nums">
                {credito.pieEstimado.moneda === "CLP"
                  ? clp(credito.pieEstimado.montoEstimado)
                  : uf(credito.pieEstimado.montoEstimado)}
              </span>
            </p>
            <BarraPie
              piePorcentaje={credito.porcentajePie}
              restoPorcentaje={credito.pieEstimado.restoPorcentaje}
            />
          </CardBody>
        </Card>
      )}
      {referencias.length > 0 && (
        <section aria-label="Valores de UF utilizados" className="rounded-xl border border-line bg-white p-5 text-sm shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-ink">Valores de UF utilizados</h2>
          <ul className="flex flex-col gap-1 text-muted">
            {referencias.map((ref) => (
              <li key={ref.fechaReferencia}>
                <span className="capitalize">{etiquetaMes(ref.fechaReferencia)}</span>:{" "}
                {formatearValorUf(ref)} · referencia {ref.fechaReferencia}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
