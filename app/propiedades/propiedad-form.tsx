"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PropiedadDto } from "@/server/services/propiedad-service";

type Props = { propiedad?: PropiedadDto };

const inputClass = "w-full rounded border px-2 py-1";

export function PropiedadForm({ propiedad }: Props) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const form = new FormData(event.currentTarget);
    const cuerpo = Object.fromEntries(form.entries());

    try {
      const respuesta = await fetch(
        propiedad ? `/api/propiedades/${propiedad.id}` : "/api/propiedades",
        {
          method: propiedad ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cuerpo),
        }
      );
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      router.push(`/propiedades/${datos.id}`);
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  function campo(
    nombre: string,
    etiqueta: string,
    opciones: { type?: string; requerido?: boolean; valor?: string | null } = {}
  ) {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{etiqueta}</span>
        <input
          name={nombre}
          type={opciones.type ?? "text"}
          required={opciones.requerido}
          defaultValue={opciones.valor ?? ""}
          className={inputClass}
        />
        {errores[nombre]?.map((mensaje) => (
          <span key={mensaje} className="block text-red-600">
            {mensaje}
          </span>
        ))}
      </label>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {campo("numeroDepartamento", "Número de departamento", {
        requerido: true,
        valor: propiedad?.numeroDepartamento,
      })}
      {campo("direccion", "Dirección (opcional)", { valor: propiedad?.direccion })}
      {campo("superficieM2", "Superficie (m²)", { requerido: true, valor: propiedad?.superficieM2 })}
      {campo("valorCompraMonto", "Valor de compra", {
        requerido: true,
        valor: propiedad?.valorCompraMonto,
      })}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Moneda</span>
        <select
          name="valorCompraMoneda"
          defaultValue={propiedad?.valorCompraMoneda ?? "UF"}
          className={inputClass}
        >
          <option value="UF">UF</option>
          <option value="CLP">CLP</option>
        </select>
        {errores.valorCompraMoneda?.map((mensaje) => (
          <span key={mensaje} className="block text-red-600">
            {mensaje}
          </span>
        ))}
      </label>
      {campo("fechaCompra", "Fecha de compra", {
        type: "date",
        requerido: true,
        valor: propiedad?.fechaCompra,
      })}
      {campo("estacionamiento", "Estacionamiento (opcional)", { valor: propiedad?.estacionamiento })}
      {campo("bodega", "Bodega (opcional)", { valor: propiedad?.bodega })}
      {errorGeneral && <p className="text-red-600">{errorGeneral}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {enviando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
