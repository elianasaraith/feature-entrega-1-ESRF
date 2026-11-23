import { Suspense } from "react";
import Link from "next/link";
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

export default function CreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <DetalleCredito params={params} />
      </Suspense>
    </main>
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

  const volver = (
    <Link href={`/propiedades/${propiedad.id}`} className="text-sm underline">
      ← Departamento {propiedad.numeroDepartamento}
    </Link>
  );

  if (!credito) {
    return (
      <>
        {volver}
        <h1 className="my-4 text-2xl font-semibold">Crédito hipotecario</h1>
        <p className="mb-4 text-sm">Esta propiedad no tiene crédito hipotecario registrado.</p>
        <Link
          href={`/propiedades/${propiedad.id}/credito/nuevo`}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Registrar crédito
        </Link>
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
    ["Cuota contractual", `${credito.cuotaContractualUf} UF · ${textoClp(credito.cuotaContractualClp, varias)}`],
    [
      "Saldo inicial",
      credito.saldoInicialUf
        ? `${credito.saldoInicialUf} UF · ${textoClp(
            credito.saldoInicialClp,
            varias,
            credito.fechaOtorgamiento === null ? "Sin fecha de otorgamiento" : undefined
          )}`
        : "—",
    ],
    [
      "Último saldo registrado",
      ultimoSaldo
        ? `${ultimoSaldo.saldoPendienteUf} UF (período ${ultimoSaldo.periodo}) · ${textoClp(ultimoSaldo.equivalenteClp, varias)}`
        : "No registrado",
    ],
    ["Tasa de interés anual", `${credito.tasaInteresAnual} %`],
    ["Número total de cuotas", String(credito.numeroCuotasTotal)],
    ["Día de vencimiento", String(credito.diaVencimiento)],
    ["Seguros", credito.segurosUf ? `${credito.segurosUf} UF` : "—"],
    ["Monto original", credito.montoOriginalUf ? `${credito.montoOriginalUf} UF` : "—"],
    ["Número de crédito", credito.numeroCredito ?? "—"],
    ["Fecha de otorgamiento", credito.fechaOtorgamiento ?? "—"],
  ];

  return (
    <>
      {volver}
      <div className="my-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crédito hipotecario</h1>
        <Link
          href={`/propiedades/${propiedad.id}/credito/editar`}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Editar
        </Link>
      </div>
      {referencias.length > 0 && (
        <section aria-label="Valores de UF utilizados" className="mb-4 text-xs text-black/60">
          <h2 className="mb-1 font-medium">Valores de UF utilizados</h2>
          <ul className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:gap-x-4">
            {referencias.map((ref) => (
              <li key={ref.fechaReferencia}>
                <span className="capitalize">{etiquetaMes(ref.fechaReferencia)}</span>:{" "}
                {formatearValorUf(ref)} · referencia {ref.fechaReferencia}
              </li>
            ))}
          </ul>
        </section>
      )}
      <dl className="grid grid-cols-[12rem_1fr] gap-y-2 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents">
            <dt className="font-medium">{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm">
        <Link
          href={`/propiedades/${propiedad.id}/credito/registro-mensual`}
          className="underline"
        >
          Registro mensual de dividendo y saldo
        </Link>
      </p>
    </>
  );
}
