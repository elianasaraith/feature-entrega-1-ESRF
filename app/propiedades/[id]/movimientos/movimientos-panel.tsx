"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIAS_MOVIMIENTO } from "@/server/domain/movimiento-agregacion";
import {
  MAX_CONCEPTOS,
  MAX_NOMBRE_CONCEPTO,
  esMontoEnteroTexto,
  sumarConceptos,
} from "@/server/domain/movimiento-desglose";
import type { MovimientoDto, MovimientosListadoDto } from "@/server/services/movimiento-service";

type Props = { propiedadId: string; hoy: string; mes: string; listado: MovimientosListadoDto };

// Fila editable del desglose. `clave` es solo para React: sobrevive a quitar filas.
type Fila = { clave: number; nombre: string; montoClp: string };

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

// Solo decide si se habilita «Guardar»: el servidor sigue siendo la fuente de
// verdad (400 por formato, 422 por reglas de negocio) y sus mensajes se muestran.
const montoValido = (monto: string) => esMontoEnteroTexto(monto) && /[1-9]/.test(monto);
const filaValida = (f: Fila) => f.nombre.trim() !== "" && montoValido(f.montoClp.trim());

// Lista los egresos del mes y permite registrar, editar y eliminar, como gasto
// simple o desglosado en conceptos. El total y el desglose por categoría del mes
// los calcula el servidor; el total en vivo del formulario lo calcula la función
// pura de dominio `sumarConceptos`, sin reglas financieras propias. Tras cada
// cambio se refresca la página para releerlos.
export function MovimientosPanel({ propiedadId, hoy, mes, listado }: Props) {
  const router = useRouter();
  const base = `/api/propiedades/${propiedadId}/movimientos`;
  // null = cerrado; { movimiento: null } = alta; { movimiento } = edición.
  const [formulario, setFormulario] = useState<{ movimiento: MovimientoDto | null } | null>(null);
  // Estado del formulario que debe sobrevivir a alternar entre simple y desglosado:
  // el monto del gasto simple y las filas se conservan aunque la opción cambie.
  const [desglosar, setDesglosar] = useState(false);
  const [montoSimple, setMontoSimple] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const siguienteClave = useRef(0);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const nuevaFila = (nombre = "", montoClp = ""): Fila => ({ clave: siguienteClave.current++, nombre, montoClp });

  function abrir(movimiento: MovimientoDto | null) {
    const conceptos = movimiento?.conceptos ?? [];
    setFormulario({ movimiento });
    setDesglosar(conceptos.length > 0);
    setMontoSimple(movimiento?.montoClp ?? "");
    // Los conceptos llegan ordenados (campo `orden`): el formulario conserva ese orden.
    setFilas(conceptos.length > 0 ? conceptos.map((c) => nuevaFila(c.nombre, c.montoClp)) : [nuevaFila()]);
    setErrores({});
    setErrorGeneral(null);
  }

  // Un error de fila deja de ser válido al cambiar las filas (los índices se mueven).
  const limpiarErroresDeConceptos = () =>
    setErrores((prev) => Object.fromEntries(Object.entries(prev).filter(([clave]) => !clave.startsWith("conceptos"))));

  function cambiarFila(clave: number, cambio: Partial<Omit<Fila, "clave">>) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
    limpiarErroresDeConceptos();
  }

  function agregarFila() {
    setFilas((prev) => (prev.length >= MAX_CONCEPTOS ? prev : [...prev, nuevaFila()]));
    limpiarErroresDeConceptos();
  }

  function quitarFila(clave: number) {
    setFilas((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.clave !== clave)));
    limpiarErroresDeConceptos();
  }

  const total = sumarConceptos(filas.map((f) => f.montoClp.trim()).filter(esMontoEnteroTexto));
  const hayFilasInvalidas = filas.some((f) => !filaValida(f));
  const conceptosPrevios = formulario?.movimiento?.conceptos.length ?? 0;
  // Editando un desglosado con la opción apagada: guardar elimina sus conceptos.
  const descartaDesglose = conceptosPrevios > 0 && !desglosar;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formulario) return;
    if (desglosar && hayFilasInvalidas) return; // el botón ya está deshabilitado; defensa
    const campos = Object.fromEntries(new FormData(event.currentTarget).entries());
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    const { movimiento } = formulario;
    // Siempre se envía `conceptos` de forma explícita. Desglosado: la lista, sin
    // `montoClp` (el total lo calcula el servidor). Simple: `[]` y el monto.
    const cuerpo = desglosar
      ? {
          fecha: campos.fecha,
          categoria: campos.categoria,
          descripcion: campos.descripcion,
          conceptos: filas.map((f) => ({ nombre: f.nombre.trim(), montoClp: f.montoClp.trim() })),
        }
      : {
          fecha: campos.fecha,
          categoria: campos.categoria,
          descripcion: campos.descripcion,
          montoClp: montoSimple.trim(),
          conceptos: [],
        };
    try {
      const respuesta = await fetch(movimiento ? `${base}/${movimiento.id}` : base, {
        method: movimiento ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        // 400 trae `campos` (por campo, incl. `conceptos.N.nombre`); 422 y 404 traen
        // `error`. El formulario no se cierra ni se vacía: lo ingresado se conserva.
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? "Revisa los campos marcados." : (datos?.error ?? "No se pudo guardar"));
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
    const detalle = m.conceptos.length > 0 ? ` (con ${m.conceptos.length} conceptos)` : "";
    if (
      !window.confirm(`¿Eliminar el movimiento de ${m.montoClp} CLP del ${m.fecha}${detalle}? Esta acción no se puede deshacer.`)
    ) {
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
              <Fragment key={m.id}>
                {/* Una sola fila por movimiento, con su total; los conceptos van debajo. */}
                <tr className="border-t">
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
                {m.conceptos.length > 0 && (
                  <tr>
                    <td />
                    <td colSpan={4} className="pb-2">
                      <p className="text-xs font-medium">Desglosado en {m.conceptos.length} conceptos</p>
                      <ul className="list-disc pl-5 text-xs">
                        {m.conceptos.map((c) => (
                          <li key={c.id}>
                            {c.nombre}: {c.montoClp} CLP
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
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

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={desglosar} onChange={(e) => setDesglosar(e.target.checked)} />
            <span className="font-medium">Desglosar en conceptos</span>
          </label>

          {desglosar ? (
            <fieldset className="space-y-2 rounded border p-2">
              <legend className="px-1 text-xs font-medium">Conceptos (máximo {MAX_CONCEPTOS})</legend>
              {filas.map((f, i) => (
                <div key={f.clave} className="grid grid-cols-[1fr_9rem_auto] items-start gap-2 text-sm">
                  <div>
                    <input
                      aria-label={`Nombre del concepto ${i + 1}`}
                      placeholder="Nombre (ej. Materiales)"
                      type="text"
                      maxLength={MAX_NOMBRE_CONCEPTO}
                      value={f.nombre}
                      onChange={(e) => cambiarFila(f.clave, { nombre: e.target.value })}
                      className={inputClass}
                    />
                    {mensajes(`conceptos.${i}.nombre`)}
                  </div>
                  <div>
                    <input
                      aria-label={`Monto del concepto ${i + 1} (CLP)`}
                      placeholder="Monto CLP"
                      type="text"
                      inputMode="numeric"
                      value={f.montoClp}
                      onChange={(e) => cambiarFila(f.clave, { montoClp: e.target.value })}
                      className={inputClass}
                    />
                    {mensajes(`conceptos.${i}.montoClp`)}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarFila(f.clave)}
                    disabled={filas.length <= 1}
                    className="px-2 py-1 text-red-700 underline disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {mensajes("conceptos")}
              {hayFilasInvalidas && (
                <p className="text-xs text-gray-600">
                  Cada concepto necesita un nombre y un monto entero mayor que 0. Completa o quita las filas
                  incompletas para poder guardar.
                </p>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={agregarFila}
                  disabled={filas.length >= MAX_CONCEPTOS}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                >
                  Agregar concepto
                </button>
                <span className="text-xs">{filas.length} de {MAX_CONCEPTOS}</span>
              </div>
              <p className="text-sm font-semibold">Total: {total} CLP</p>
              {mensajes("montoClp")}
            </fieldset>
          ) : (
            <>
              {descartaDesglose && (
                <p role="alert" className="rounded border border-amber-400 p-2 text-sm text-amber-800">
                  Al guardar se eliminarán los {conceptosPrevios} conceptos de este gasto y quedará como gasto
                  simple. Vuelve a activar «Desglosar en conceptos» para conservarlos.
                </p>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Monto (CLP)</span>
                <input
                  name="montoClp"
                  type="text"
                  inputMode="numeric"
                  required
                  value={montoSimple}
                  onChange={(e) => setMontoSimple(e.target.value)}
                  className={inputClass}
                />
                {mensajes("montoClp")}
              </label>
            </>
          )}

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
              disabled={enviando || (desglosar && hayFilasInvalidas)}
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
