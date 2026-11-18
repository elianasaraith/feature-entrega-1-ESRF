import { Suspense } from "react";
import Link from "next/link";
import { propiedadService } from "@/server/services";

// Con cacheComponents los datos de la BD se leen en cada petición y deben
// quedar dentro de un límite <Suspense>.
export default function PropiedadesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <ListadoPropiedades />
      </Suspense>
    </main>
  );
}

async function ListadoPropiedades() {
  const propiedades = await propiedadService.listar();

  return (
    <>
      {/* Mismo patrón que el enlace «← Inicio» del dashboard; sin layout compartido. */}
      <Link href="/" className="mb-4 flex w-fit items-center gap-1 py-1 text-sm underline">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
        </svg>
        Inicio
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Propiedades</h1>
        <Link href="/propiedades/nueva" className="rounded bg-black px-3 py-2 text-sm text-white">
          Nueva propiedad
        </Link>
      </div>
      {propiedades.length === 0 ? (
        <p>No hay propiedades registradas.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Depto.</th>
              <th>Superficie</th>
              <th>Valor de compra</th>
              <th>Fecha de compra</th>
            </tr>
          </thead>
          <tbody>
            {propiedades.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">
                  <Link href={`/propiedades/${p.id}`} className="underline">
                    {p.numeroDepartamento}
                  </Link>
                </td>
                <td>{p.superficieM2} m²</td>
                <td>
                  {p.valorCompraMonto} {p.valorCompraMoneda}
                </td>
                <td>{p.fechaCompra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
