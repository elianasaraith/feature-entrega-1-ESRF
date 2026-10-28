"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArrendatarioDto } from "@/server/services/arrendatario-service";
import type { ContratoDto } from "@/server/services/contrato-service";

type Props = {
  propiedadId: string;
  arrendatarios: ArrendatarioDto[];
  contrato?: ContratoDto;
};

const inputClass = "w-full rounded border px-2 py-1";

// Alta (POST; arrendatario existente o nuevo; monto inicial opcional) o edición
// (PUT; cuerpo completo, arrendatario existente, sin monto: reajustes son T05).
export function ContratoForm({ propiedadId, arrendatarios, contrato }: Props) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState(!contrato && arrendatarios.length === 0);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const base = `/api/propiedades/${propiedadId}/contratos`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const campos = Object.fromEntries(new FormData(event.currentTarget).entries());
    const cuerpo: Record<string, unknown> = {
      fechaInicio: campos.fechaInicio,
      fechaTermino: campos.fechaTermino,
      diaEsperadoPago: campos.diaEsperadoPago === "" ? null : Number(campos.diaEsperadoPago),
      garantiaClp: campos.garantiaClp,
      observaciones: campos.observaciones,
    };
    if (contrato) {
      cuerpo.arrendatarioId = campos.arrendatarioId;
    } else {
      cuerpo.montoMensualClp = campos.montoMensualClp;
      if (nuevo) {
        cuerpo.arrendatario = {
          nombre: campos.arrNombre,
          rut: campos.arrRut,
          email: campos.arrEmail,
          telefono: campos.arrTelefono,
        };
      } else {
        cuerpo.arrendatarioId = campos.arrendatarioId;
      }
    }

    try {
      const respuesta = await fetch(contrato ? `${base}/${contrato.id}` : base, {
        method: contrato ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
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
    errores[nombre]?.map((mensaje) => (
      <span key={mensaje} className="block text-red-600">
        {mensaje}
      </span>
    ));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!contrato && (
        <div className="flex gap-4 text-sm">
          <label>
            <input type="radio" checked={!nuevo} onChange={() => setNuevo(false)} /> Arrendatario existente
          </label>
          <label>
            <input type="radio" checked={nuevo} onChange={() => setNuevo(true)} /> Arrendatario nuevo
          </label>
        </div>
      )}
      {nuevo && !contrato ? (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nombre del arrendatario</span>
            <input name="arrNombre" type="text" required className={inputClass} />
            {mensajes("arrendatario.nombre")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">RUT (opcional)</span>
            <input name="arrRut" type="text" className={inputClass} />
            {mensajes("arrendatario.rut")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email (opcional)</span>
            <input name="arrEmail" type="text" className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Teléfono (opcional)</span>
            <input name="arrTelefono" type="text" className={inputClass} />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Arrendatario</span>
          <select
            name="arrendatarioId"
            required
            defaultValue={contrato?.arrendatario.id ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Seleccione…
            </option>
            {arrendatarios.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {a.rut ? ` (${a.rut})` : ""}
              </option>
            ))}
          </select>
          {mensajes("arrendatarioId")}
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fecha de inicio</span>
        <input name="fechaInicio" type="date" required defaultValue={contrato?.fechaInicio ?? ""} className={inputClass} />
        {mensajes("fechaInicio")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fecha de término</span>
        <input name="fechaTermino" type="date" required defaultValue={contrato?.fechaTermino ?? ""} className={inputClass} />
        {mensajes("fechaTermino")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Día esperado de pago (1 a 31)</span>
        <input
          name="diaEsperadoPago"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={contrato?.diaEsperadoPago ?? ""}
          className={inputClass}
        />
        {mensajes("diaEsperadoPago")}
      </label>
      {!contrato && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Monto mensual inicial (CLP, opcional)</span>
          <input name="montoMensualClp" type="text" inputMode="numeric" className={inputClass} />
          {mensajes("montoMensualClp")}
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Garantía (CLP, opcional; dato contractual, no ingreso)</span>
        <input name="garantiaClp" type="text" inputMode="numeric" defaultValue={contrato?.garantiaClp ?? ""} className={inputClass} />
        {mensajes("garantiaClp")}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Observaciones (opcional)</span>
        <textarea name="observaciones" defaultValue={contrato?.observaciones ?? ""} className={inputClass} />
      </label>
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
