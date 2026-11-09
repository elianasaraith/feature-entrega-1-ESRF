"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AbonoDto, PagoDto } from "@/server/services/pago-service";

type Props = { propiedadId: string; contratoId: string; hoy: string; pagos: PagoDto[] };

const inputClass = "w-full rounded border px-2 py-1";
const ETIQUETA: Record<PagoDto["estado"], string> = {
  PENDIENTE: "Pendiente",
  PARCIALMENTE_PAGADO: "Parcialmente pagado",
  VENCIDO: "Vencido",
  PAGADO: "Pagado",
};

// Lista pagos con su estado y permite registrar, editar y eliminar abonos. El
// estado, el saldo y las calificaciones los calcula el servidor: aquí solo se
// muestran. Tras cada cambio se refresca la página para releerlos.
export function PagosPanel({ propiedadId, contratoId, hoy, pagos }: Props) {
  const router = useRouter();
  const base = `/api/propiedades/${propiedadId}/contratos/${contratoId}/pagos-esperados`;
  // Formulario abierto: alta sobre un pago o edición de un abono concreto.
  const [formulario, setFormulario] = useState<{ pagoId: string; abono: AbonoDto | null } | null>(null);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function abrir(pagoId: string, abono: AbonoDto | null) {
    setFormulario({ pagoId, abono });
    setErrores({});
    setErrorGeneral(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formulario) return;
    const campos = Object.fromEntries(new FormData(event.currentTarget).entries());
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    const { pagoId, abono } = formulario;
    try {
      const respuesta = await fetch(
        `${base}/${pagoId}/abonos${abono ? `/${abono.id}` : ""}`,
        {
          method: abono ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            montoClp: campos.montoClp,
            fechaRecepcion: campos.fechaRecepcion,
            medio: campos.medio,
          }),
        }
      );
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      setFormulario(null);
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(pagoId: string, abono: AbonoDto) {
    if (!window.confirm(`¿Eliminar el abono de ${abono.montoClp} CLP del ${abono.fechaRecepcion}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setErrorGeneral(null);
    try {
      const respuesta = await fetch(`${base}/${pagoId}/abonos/${abono.id}`, { method: "DELETE" });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null);
        setErrorGeneral(datos?.error ?? "No se pudo eliminar");
        return;
      }
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo eliminar");
    }
  }

  const mensajes = (nombre: string) =>
    errores[nombre]?.map((mensaje) => (
      <span key={mensaje} className="block text-red-600">
        {mensaje}
      </span>
    ));

  if (pagos.length === 0) {
    return <p className="text-sm">Este contrato aún no tiene pagos esperados.</p>;
  }

  return (
    <div className="space-y-4">
      {errorGeneral && <p className="text-red-600">{errorGeneral}</p>}
      {pagos.map((p) => (
        <section key={p.id} className="rounded border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{p.periodo.slice(0, 7)}</h2>
            <span className="text-sm font-medium">
              {ETIQUETA[p.estado]}
              {p.vencidoConAbonosParciales && " · con abonos parciales"}
              {p.pagadoConAtraso && " · con atraso"}
            </span>
          </div>
          <dl className="my-2 grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs">Esperado (CLP)</dt>
              <dd>{p.montoEsperadoClp}</dd>
            </div>
            <div>
              <dt className="text-xs">Recibido (CLP)</dt>
              <dd>{p.recibidoClp}</dd>
            </div>
            <div>
              <dt className="text-xs">Saldo pendiente (CLP)</dt>
              <dd>{p.saldoPendienteClp}</dd>
            </div>
            <div>
              <dt className="text-xs">
                Fecha esperada{p.fechaEsperada < hoy && p.estado !== "PAGADO" ? " (vencida)" : ""}
              </dt>
              <dd>
                {p.fechaEsperada}
                {p.fechaCompletitud && <span className="block text-xs">Completado el {p.fechaCompletitud}</span>}
              </dd>
            </div>
          </dl>

          {p.abonos.length > 0 && (
            <table className="mb-2 w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-1">Recepción</th>
                  <th>Monto (CLP)</th>
                  <th>Medio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.abonos.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-1">{a.fechaRecepcion}</td>
                    <td>{a.montoClp}</td>
                    <td>{a.medio ?? "—"}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => abrir(p.id, a)} className="underline">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(p.id, a)}
                        className="ml-3 text-red-700 underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {formulario?.pagoId === p.id ? (
            <form
              key={formulario.abono?.id ?? "nuevo"}
              onSubmit={onSubmit}
              className="space-y-3 rounded border p-3"
            >
              <h3 className="text-sm font-semibold">
                {formulario.abono ? "Editar abono" : "Registrar abono"}
              </h3>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Monto (CLP)</span>
                <input
                  name="montoClp"
                  type="text"
                  inputMode="numeric"
                  required
                  defaultValue={formulario.abono?.montoClp ?? ""}
                  className={inputClass}
                />
                {mensajes("montoClp")}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Fecha de recepción</span>
                <input
                  name="fechaRecepcion"
                  type="date"
                  required
                  max={hoy}
                  defaultValue={formulario.abono?.fechaRecepcion ?? hoy}
                  className={inputClass}
                />
                {mensajes("fechaRecepcion")}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Medio (opcional)</span>
                <input
                  name="medio"
                  type="text"
                  placeholder="Transferencia, depósito, efectivo"
                  defaultValue={formulario.abono?.medio ?? ""}
                  className={inputClass}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={enviando}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {enviando ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormulario(null)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => abrir(p.id, null)} className="rounded border px-3 py-1 text-sm">
              Registrar abono
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
