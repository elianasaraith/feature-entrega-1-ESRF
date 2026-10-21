import Link from "next/link";
import { PropiedadForm } from "../propiedad-form";

export default function NuevaPropiedadPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Link href="/propiedades" className="text-sm underline">
        ← Propiedades
      </Link>
      <h1 className="my-4 text-2xl font-semibold">Nueva propiedad</h1>
      <PropiedadForm />
    </main>
  );
}
