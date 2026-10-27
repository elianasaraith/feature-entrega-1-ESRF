import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { creditoRegistroService, propiedadService } from "@/server/services";
import type { RegistroMensualDto } from "@/server/services/credito-registro-service";

export default function RegistroMensualPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <Historial params={params} />
      </Suspense>
    </main>
  );
}

const NO_REGISTRADO = "No registrado";
// El equivalente en CLP depende de valor_uf_periodo (T10, pendiente).
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

  let registros: RegistroMensualDto[] | null = null;
  try {
    registros = await creditoRegistroService.listar(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  const volver = (
    <Link href={`/propiedades/${propiedad.id}/credito`} className="text-sm underline">
      ← Crédito hipotecario
    </Link>
  );

  if (!registros) {
    return (
      <>
        {volver}
        <h1 className="my-4 text-2xl font-semibold">Registro mensual</h1>
        <p className="text-sm">
          Esta propiedad no tiene crédito hipotecario: registre el crédito para llevar su registro
          mensual.
        </p>
      </>
    );
  }

  return (
    <>
      {volver}
      <div className="my-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Registro mensual · departamento {propiedad.numeroDepartamento}
        </h1>
        <Link
          href={`/propiedades/${propiedad.id}/credito/registro-mensual/nuevo`}
          className="rounded bg-black px-3 py-2 text-sm text-white"
        >
          Registrar mes
        </Link>
      </div>
      {registros.length === 0 ? (
        <p className="text-sm">{NO_REGISTRADO}: aún no hay meses registrados.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-1">Período</th>
              <th>Dividendo pagado (CLP)</th>
              <th>Fecha de pago</th>
              <th>Saldo pendiente (UF)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.periodo} className="border-t align-top">
                <td className="py-1">{r.periodo}</td>
                <td>{r.dividendoPagadoClp ?? NO_REGISTRADO}</td>
                <td>
                  {r.fechaPagoDividendo ?? NO_REGISTRADO}
                  {correspondiente(r) && (
                    <span className="block text-xs">{correspondiente(r)}</span>
                  )}
                </td>
                <td>
                  {r.saldoPendienteUf ? (
                    <>
                      {r.saldoPendienteUf} UF
                      <span className="block text-xs">CLP: {CLP_NO_DISPONIBLE}</span>
                    </>
                  ) : (
                    NO_REGISTRADO
                  )}
                </td>
                <td>
                  <Link
                    href={`/propiedades/${propiedad.id}/credito/registro-mensual/${r.periodo}/editar`}
                    className="underline"
                  >
                    Editar
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
