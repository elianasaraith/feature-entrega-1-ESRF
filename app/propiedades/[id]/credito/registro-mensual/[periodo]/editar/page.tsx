import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NotFoundError } from "@/server/errors";
import { periodoSchema } from "@/server/schemas/credito-registro";
import { creditoRegistroService, propiedadService } from "@/server/services";
import { RegistroForm } from "../../registro-form";

export default function EditarRegistroPage({
  params,
}: {
  params: Promise<{ id: string; periodo: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p>Cargando…</p>}>
        <EditarRegistro params={params} />
      </Suspense>
    </main>
  );
}

async function EditarRegistro({ params }: { params: Promise<{ id: string; periodo: string }> }) {
  const { id, periodo } = await params;
  const valido = periodoSchema.safeParse(periodo);
  if (!valido.success) notFound();

  const propiedad = await propiedadService.obtener(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const registro = await creditoRegistroService
    .obtenerPorPeriodo(id, valido.data)
    .catch((error) => {
      if (error instanceof NotFoundError) redirect(`/propiedades/${id}/credito/nuevo`);
      throw error;
    });
  // PUT nunca crea: un mes sin registro se da de alta, no se edita.
  if (!registro.registrado) redirect(`/propiedades/${id}/credito/registro-mensual/nuevo`);

  return (
    <>
      <Link
        href={`/propiedades/${propiedad.id}/credito/registro-mensual`}
        className="text-sm underline"
      >
        ← Registro mensual
      </Link>
      <h1 className="my-4 text-2xl font-semibold">
        Editar {registro.periodo} · departamento {propiedad.numeroDepartamento}
      </h1>
      <RegistroForm propiedadId={propiedad.id} registro={registro} />
    </>
  );
}
