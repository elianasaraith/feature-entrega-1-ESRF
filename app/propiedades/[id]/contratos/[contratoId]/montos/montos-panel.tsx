"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MontoDto } from "@/server/services/contrato-service";

type Props = {
  propiedadId: string;
  contratoId: string;
  fechaInicio: string;
  fechaTermino: string;
  montos: MontoDto[];
  montoVigenteClp: string | null;
};

const inputClass = "w-full rounded border px-2 py-1";

// Historial de montos, alta del primer monto o de un reajuste, y sincronización
// explícita de pagos esperados. Todo cálculo ocurre en el servidor.
export function MontosPanel({
  propiedadId,
  contratoId,
  fechaInicio,
  fechaTermino,
  montos,
  montoVigenteClp,
}: Props) {
  const router = useRouter();
  const base = `/api/propiedades/${propiedadId}/contratos/${contratoId}`;
  const primero = montos.length === 0;
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    const campos = Object.fromEntries(new FormData(formulario).entries());
    try {
      const respuesta = await fetch(`${base}/montos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          montoMensualClp: campos.montoMensualClp,
          vigenteDesdePeriodo: primero ? fechaInicio.slice(0, 7) : campos.vigenteDesdePeriodo,
          motivo: campos.motivo,
        }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      formulario.reset();
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    setResultado(null);
    setErrorGeneral(null);
    try {
      const respuesta = await fetch(`${base}/pagos-esperados/sincronizar`, { method: "POST" });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrorGeneral(datos?.error ?? "No se pudo sincronizar");
        return;
      }
      setResultado(`Pagos esperados creados: ${datos.creados}. Ya existentes: ${datos.existentes}.`);
    } catch {
      setErrorGeneral("No se pudo sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  const mensajes = (nombre: string) =>
    errores[nombre]?.map((mensaje) => (
      <span key={mensaje} className="block text-red-600">
        {mensaje}
      </span>
    ));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Historial de montos</h2>
        {primero ? (
          <p className="text-sm">Este contrato aún no tiene monto registrado.</p>
        ) : (
          <>
            <p className="mb-2 text-sm">
              Monto vigente este mes: <strong>{montoVigenteClp ?? "—"} CLP</strong>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-1">Rige desde</th>
                  <th>Monto (CLP)</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {montos.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-1">{m.vigenteDesdePeriodo.slice(0, 7)}</td>
                    <td>{m.montoMensualClp}</td>
                    <td>{m.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          {primero ? "Registrar primer monto" : "Registrar reajuste"}
        </h2>
        <form onSubmit={onSubmit} className="space-y-3">
          {primero ? (
            <p className="text-sm">Regirá desde {fechaInicio.slice(0, 7)} (mes de inicio del contrato).</p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Rige desde (mes, entre {fechaInicio.slice(0, 7)} y {fechaTermino.slice(0, 7)})
              </span>
              <input name="vigenteDesdePeriodo" type="month" required className={inputClass} />
              {mensajes("vigenteDesdePeriodo")}
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Monto mensual (CLP)</span>
            <input name="montoMensualClp" type="text" inputMode="numeric" required className={inputClass} />
            {mensajes("montoMensualClp")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Motivo (opcional)</span>
            <input name="motivo" type="text" className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={enviando}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Pagos esperados</h2>
        <p className="mb-2 text-sm">
          Crea los pagos esperados que faltan, desde el inicio del contrato hasta el mes en curso.
          Se puede repetir sin efectos duplicados.
        </p>
        <button
          type="button"
          onClick={sincronizar}
          disabled={sincronizando || primero}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar pagos esperados"}
        </button>
        {primero && <p className="mt-1 text-sm">Registre primero el monto del contrato.</p>}
        {resultado && <p className="mt-2 text-sm">{resultado}</p>}
      </section>

      {errorGeneral && <p className="text-red-600">{errorGeneral}</p>}
    </div>
  );
}
