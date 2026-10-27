"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistroMensualDto } from "@/server/services/credito-registro-service";

type Props = { propiedadId: string; registro?: RegistroMensualDto };

const inputClass = "w-full rounded border px-2 py-1";

// Alta (POST, con período) o edición (PUT, período fijo y datos precargados).
// La edición envía siempre el cuerpo completo.
export function RegistroForm({ propiedadId, registro }: Props) {
  const router = useRouter();
  const [dividendo, setDividendo] = useState(registro?.dividendoPagadoClp ?? "");
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const base = `/api/propiedades/${propiedadId}/credito/registro-mensual`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const cuerpo = Object.fromEntries(new FormData(event.currentTarget).entries());
    // Sin dividendo no hay fecha de pago: se descarta aunque quede texto en el campo.
    if (!String(cuerpo.dividendoPagadoClp ?? "").trim()) cuerpo.fechaPagoDividendo = "";

    try {
      const respuesta = await fetch(registro ? `${base}/${registro.periodo}` : base, {
        method: registro ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      router.push(`/propiedades/${propiedadId}/credito/registro-mensual`);
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  const mensajes = (nombre: string) =>
    errores[nombre]?.map((mensaje) => (
      <span key={mensaje} className="block text-red-600">
        {mensaje}
      </span>
    ));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Período (mensualidad hipotecaria)</span>
        <input
          name="periodo"
          type="month"
          required
          readOnly={Boolean(registro)}
          defaultValue={registro?.periodo ?? ""}
          className={inputClass}
        />
        {mensajes("periodo")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Dividendo pagado (CLP, opcional)</span>
        <input
          name="dividendoPagadoClp"
          type="text"
          inputMode="numeric"
          value={dividendo}
          onChange={(e) => setDividendo(e.target.value)}
          className={inputClass}
        />
        {mensajes("dividendoPagadoClp")}
      </label>
      {dividendo.trim() !== "" && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Fecha de pago del dividendo</span>
          <input
            name="fechaPagoDividendo"
            type="date"
            required
            defaultValue={registro?.fechaPagoDividendo ?? ""}
            className={inputClass}
          />
          {mensajes("fechaPagoDividendo")}
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Saldo pendiente informado por el banco (UF, opcional)</span>
        <input
          name="saldoPendienteUf"
          type="text"
          inputMode="decimal"
          defaultValue={registro?.saldoPendienteUf ?? ""}
          className={inputClass}
        />
        {mensajes("saldoPendienteUf")}
      </label>
      {dividendo.trim() === "" && mensajes("fechaPagoDividendo")}
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
