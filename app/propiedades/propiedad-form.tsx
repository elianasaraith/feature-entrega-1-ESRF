"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PropiedadDto } from "@/server/services/propiedad-service";
import { Alert, Button, ButtonLink, FormField, Input, Select } from "../_ui";

type Props = { propiedad?: PropiedadDto };

export function PropiedadForm({ propiedad }: Props) {
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
      <FormField etiqueta={etiqueta} errores={errores[nombre]} requerido={opciones.requerido}>
        <Input
          name={nombre}
          type={opciones.type ?? "text"}
          required={opciones.requerido}
          defaultValue={opciones.valor ?? ""}
          aria-invalid={errores[nombre] ? true : undefined}
        />
      </FormField>
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
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("valorCompraMonto", "Valor de compra", {
          requerido: true,
          valor: propiedad?.valorCompraMonto,
        })}
        <FormField etiqueta="Moneda" errores={errores.valorCompraMoneda}>
          <Select
            name="valorCompraMoneda"
            defaultValue={propiedad?.valorCompraMoneda ?? "UF"}
            aria-invalid={errores.valorCompraMoneda ? true : undefined}
          >
            <option value="UF">UF</option>
            <option value="CLP">CLP</option>
          </Select>
        </FormField>
      </div>
      {campo("fechaCompra", "Fecha de compra", {
        type: "date",
        requerido: true,
        valor: propiedad?.fechaCompra,
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("estacionamiento", "Estacionamiento (opcional)", { valor: propiedad?.estacionamiento })}
        {campo("bodega", "Bodega (opcional)", { valor: propiedad?.bodega })}
      </div>
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink href={propiedad ? `/propiedades/${propiedad.id}` : "/propiedades"} variante="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
