import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoService, propiedadService } from "@/server/services";
import type { CreditoDto } from "@/server/services/credito-service";

export default function CreditoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <DetalleCredito params={params} />
      </Suspense>
    </main>
  );
}

// El equivalente en CLP depende de valor_uf_periodo (T10, pendiente).
const CLP_NO_DISPONIBLE = "No disponible";

async function DetalleCredito({ params }: { params: Promise<{ id: string }> }) {
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

  const filas: [string, string][] = [
    ["Banco", credito.banco],
    ["Cuota contractual", `${credito.cuotaContractualUf} UF · CLP: ${CLP_NO_DISPONIBLE}`],
    [
      "Saldo inicial",
      credito.saldoInicialUf
        ? `${credito.saldoInicialUf} UF · CLP: ${CLP_NO_DISPONIBLE}`
        : "—",
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
      <dl className="grid grid-cols-[12rem_1fr] gap-y-2 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents">
            <dt className="font-medium">{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
