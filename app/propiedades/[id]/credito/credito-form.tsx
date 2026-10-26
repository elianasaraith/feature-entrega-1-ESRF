"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditoDto } from "@/server/services/credito-service";

type Props = { propiedadId: string; credito?: CreditoDto };

const inputClass = "w-full rounded border px-2 py-1";

export function CreditoForm({ propiedadId, credito }: Props) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const cuerpo = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const respuesta = await fetch(`/api/propiedades/${propiedadId}/credito`, {
        method: credito ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      router.push(`/propiedades/${propiedadId}/credito`);
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
    opciones: { type?: string; requerido?: boolean; valor?: string | number | null } = {}
  ) {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{etiqueta}</span>
        <input
          name={nombre}
          type={opciones.type ?? "text"}
          inputMode={opciones.type ? undefined : "decimal"}
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
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Banco</span>
        <input
          name="banco"
          type="text"
          required
          defaultValue={credito?.banco ?? ""}
          className={inputClass}
        />
        {errores.banco?.map((mensaje) => (
          <span key={mensaje} className="block text-red-600">
            {mensaje}
          </span>
        ))}
      </label>
      {campo("cuotaContractualUf", "Cuota contractual (UF)", {
        requerido: true,
        valor: credito?.cuotaContractualUf,
      })}
      {campo("tasaInteresAnual", "Tasa de interés anual (%)", {
        requerido: true,
        valor: credito?.tasaInteresAnual,
      })}
      {campo("numeroCuotasTotal", "Número total de cuotas", {
        type: "number",
        requerido: true,
        valor: credito?.numeroCuotasTotal,
      })}
      {campo("diaVencimiento", "Día de vencimiento (1–31)", {
        type: "number",
        requerido: true,
        valor: credito?.diaVencimiento,
      })}
      {campo("numeroCredito", "Número de crédito (opcional)", { type: "text", valor: credito?.numeroCredito })}
      {campo("fechaOtorgamiento", "Fecha de otorgamiento (opcional)", {
        type: "date",
        valor: credito?.fechaOtorgamiento,
      })}
      {campo("montoOriginalUf", "Monto original (UF, opcional)", { valor: credito?.montoOriginalUf })}
      {campo("segurosUf", "Seguros (UF, opcional)", { valor: credito?.segurosUf })}
      {campo("saldoInicialUf", "Saldo inicial (UF, opcional)", { valor: credito?.saldoInicialUf })}
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
