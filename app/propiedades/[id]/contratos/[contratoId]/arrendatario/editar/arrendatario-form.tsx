"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArrendatarioDto } from "@/server/services/arrendatario-service";
import { Alert, Button, ButtonLink, FormField, Input } from "../../../../../../_ui";

// Edición (PUT, cuerpo completo) de los datos del arrendatario de un contrato.
export function ArrendatarioForm({ propiedadId, arrendatario }: { propiedadId: string; arrendatario: ArrendatarioDto }) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField etiqueta="Nombre" requerido errores={errores.nombre}>
        <Input name="nombre" type="text" required defaultValue={arrendatario.nombre} />
      </FormField>
      <FormField etiqueta="RUT (opcional)" errores={errores.rut}>
        <Input name="rut" type="text" defaultValue={arrendatario.rut ?? ""} />
      </FormField>
      <FormField etiqueta="Email (opcional)" errores={errores.email}>
        <Input name="email" type="text" defaultValue={arrendatario.email ?? ""} />
      </FormField>
      <FormField etiqueta="Teléfono (opcional)" errores={errores.telefono}>
        <Input name="telefono" type="text" defaultValue={arrendatario.telefono ?? ""} />
      </FormField>
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink variante="secondary" href={`/propiedades/${propiedadId}/contratos`}>
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
