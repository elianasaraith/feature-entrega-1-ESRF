import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hoyChile } from "@/server/clock";
import { NotFoundError } from "@/server/errors";
import { contratoService, propiedadService } from "@/server/services";

export default function ContratosPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Contratos params={params} />
      </Suspense>
    </main>
  );
}

const VIGENCIA: Record<string, string> = {
  FUTURO: "Futuro",
  VIGENTE: "Vigente",
  FINALIZADO: "Finalizado",
};

async function Contratos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const contratos = await contratoService.listar(id, hoyChile());

  return (
    <>
      <Link href={`/propiedades/${propiedad.id}`} className="text-sm underline">
        ← Propiedad
      </Link>
      <div className="my-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Contratos · departamento {propiedad.numeroDepartamento}
        </h1>
        <Link
          href={`/propiedades/${propiedad.id}/contratos/nuevo`}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Nuevo contrato
        </Link>
      </div>
      {contratos.length === 0 ? (
        <p className="text-sm">Esta propiedad aún no tiene contratos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-1">Arrendatario</th>
              <th>Vigencia</th>
              <th>Día de pago</th>
              <th>Monto inicial (CLP)</th>
              <th>Garantía (contractual)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id} className="border-t align-top">
                <td className="py-1">{c.arrendatario.nombre}</td>
                <td>
                  {VIGENCIA[c.vigencia]}
                  <span className="block text-xs">
                    {c.fechaInicio} a {c.fechaTermino}
                  </span>
                </td>
                <td>{c.diaEsperadoPago}</td>
                <td>{c.montoInicialClp ?? "Sin monto registrado"}</td>
                <td>{c.garantiaClp ?? "—"}</td>
                <td>
                  <Link
                    href={`/propiedades/${propiedad.id}/contratos/${c.id}/editar`}
                    className="underline"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/propiedades/${propiedad.id}/contratos/${c.id}/montos`}
                    className="ml-3 underline"
                  >
                    Montos
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
