"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_MOVIMIENTO } from "@/server/domain/movimiento-agregacion";
import type { MovimientoDto, MovimientosListadoDto } from "@/server/services/movimiento-service";

type Props = { propiedadId: string; hoy: string; mes: string; listado: MovimientosListadoDto };

const inputClass = "w-full rounded border px-2 py-1";
const ETIQUETA: Record<MovimientoDto["categoria"], string> = {
  REPARACION: "Reparación",
  EQUIPAMIENTO: "Equipamiento",
  SEGURO: "Seguro",
  CONTRIBUCIONES: "Contribuciones",
  GASTO_COMUN: "Gasto común",
  GASTO_EXTRAORDINARIO: "Gasto extraordinario",
  OTRO: "Otro",
};

// Lista los egresos del mes y permite registrar, editar y eliminar. El total y
// el desglose los calcula el servidor: aquí solo se muestran. Tras cada cambio
// se refresca la página para releerlos.
export function MovimientosPanel({ propiedadId, hoy, mes, listado }: Props) {
  const router = useRouter();
  const base = `/api/propiedades/${propiedadId}/movimientos`;
  // null = cerrado; { movimiento: null } = alta; { movimiento } = edición.
  const [formulario, setFormulario] = useState<{ movimiento: MovimientoDto | null } | null>(null);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function abrir(movimiento: MovimientoDto | null) {
    setFormulario({ movimiento });
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
    const { movimiento } = formulario;
    try {
      const respuesta = await fetch(movimiento ? `${base}/${movimiento.id}` : base, {
        method: movimiento ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fecha: campos.fecha,
          categoria: campos.categoria,
          montoClp: campos.montoClp,
          descripcion: campos.descripcion,
        }),
      });
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

  async function eliminar(m: MovimientoDto) {
    if (!window.confirm(`¿Eliminar el movimiento de ${m.montoClp} CLP del ${m.fecha}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setErrorGeneral(null);
    try {
      const respuesta = await fetch(`${base}/${m.id}`, { method: "DELETE" });
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

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Mes</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && router.push(`?mes=${e.target.value}`)}
          className="rounded border px-2 py-1"
        />
      </label>

      {errorGeneral && <p className="text-red-600">{errorGeneral}</p>}

      <section className="rounded border p-3">
        <p className="text-sm font-semibold">Total del mes: {listado.totalClp} CLP</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {CATEGORIAS_MOVIMIENTO.map((c) => (
            <div key={c}>
              <dt className="text-xs">{ETIQUETA[c]}</dt>
              <dd>{listado.porCategoria[c]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {listado.movimientos.length === 0 ? (
        <p className="text-sm">No hay movimientos en este mes.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-1">Fecha</th>
              <th>Categoría</th>
              <th>Monto (CLP)</th>
              <th>Descripción</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listado.movimientos.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-1">{m.fecha}</td>
                <td>{ETIQUETA[m.categoria]}</td>
                <td>{m.montoClp}</td>
                <td>{m.descripcion ?? "—"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => abrir(m)} className="underline">
                    Editar
                  </button>
                  <button type="button" onClick={() => eliminar(m)} className="ml-3 text-red-700 underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formulario ? (
        <form
          key={formulario.movimiento?.id ?? "nuevo"}
          onSubmit={onSubmit}
          className="space-y-3 rounded border p-3"
        >
          <h2 className="text-sm font-semibold">
            {formulario.movimiento ? "Editar movimiento" : "Registrar movimiento"}
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Fecha</span>
            <input
              name="fecha"
              type="date"
              required
              max={hoy}
              defaultValue={formulario.movimiento?.fecha ?? (hoy.startsWith(mes) ? hoy : `${mes}-01`)}
              className={inputClass}
            />
            {mensajes("fecha")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Categoría</span>
            <select
              name="categoria"
              required
              defaultValue={formulario.movimiento?.categoria ?? "REPARACION"}
              className={inputClass}
            >
              {CATEGORIAS_MOVIMIENTO.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA[c]}
                </option>
              ))}
            </select>
            {mensajes("categoria")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Monto (CLP)</span>
            <input
              name="montoClp"
              type="text"
              inputMode="numeric"
              required
              defaultValue={formulario.movimiento?.montoClp ?? ""}
              className={inputClass}
            />
            {mensajes("montoClp")}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Descripción (opcional)</span>
            <input
              name="descripcion"
              type="text"
              defaultValue={formulario.movimiento?.descripcion ?? ""}
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
            <button type="button" onClick={() => setFormulario(null)} className="rounded border px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => abrir(null)} className="rounded border px-3 py-1 text-sm">
          Registrar movimiento
        </button>
      )}
    </div>
  );
}
