"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArrendatarioDto } from "@/server/services/arrendatario-service";

const inputClass = "w-full rounded border px-2 py-1";

// Edición (PUT, cuerpo completo) de los datos del arrendatario de un contrato.
export function ArrendatarioForm({ propiedadId, arrendatario }: { propiedadId: string; arrendatario: ArrendatarioDto }) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    const campos = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const respuesta = await fetch(`/api/arrendatarios/${arrendatario.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: campos.nombre, rut: campos.rut, email: campos.email, telefono: campos.telefono }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      router.push(`/propiedades/${propiedadId}/contratos`);
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  const mensajes = (nombre: string) =>
    errores[nombre]?.map((m) => (
      <span key={m} className="block text-red-600">
        {m}
      </span>
    ));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Nombre</span>
        <input name="nombre" type="text" required defaultValue={arrendatario.nombre} className={inputClass} />
        {mensajes("nombre")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">RUT (opcional)</span>
        <input name="rut" type="text" defaultValue={arrendatario.rut ?? ""} className={inputClass} />
        {mensajes("rut")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email (opcional)</span>
        <input name="email" type="text" defaultValue={arrendatario.email ?? ""} className={inputClass} />
        {mensajes("email")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Teléfono (opcional)</span>
        <input name="telefono" type="text" defaultValue={arrendatario.telefono ?? ""} className={inputClass} />
        {mensajes("telefono")}
      </label>
      {errorGeneral && (
        <p role="alert" className="text-sm text-red-600">
          {errorGeneral}
        </p>
      )}
      <button type="submit" disabled={enviando} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {enviando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
