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
import { clp, fecha } from "../../../_lib/format";
import { Alert, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, DataTable, EmptyState, FormField, Input, Select, Td, Th } from "../../../_ui";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { MovimientoDto, MovimientosListadoDto } from "@/server/services/movimiento-service";

type Props = { propiedadId: string; hoy: string; mes: string; listado: MovimientosListadoDto };

// Fila editable del desglose. `clave` es solo para React: sobrevive a quitar filas.
type Fila = { clave: number; nombre: string; montoClp: string };

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
    if (!formulario || enviando) return;
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

  const [aEliminar, setAEliminar] = useState<MovimientoDto | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    if (!aEliminar) return;
    setErrorGeneral(null);
    setEliminando(true);
    try {
      const respuesta = await fetch(`${base}/${aEliminar.id}`, { method: "DELETE" });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null);
        setErrorGeneral(datos?.error ?? "No se pudo eliminar");
        return;
      }
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo eliminar");
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Mes</span>
          <Input
            type="month"
            value={mes}
            onChange={(e) => e.target.value && router.push(`?mes=${e.target.value}`)}
            className="h-10 w-44"
          />
        </label>
        {!formulario && (
          <Button onClick={() => abrir(null)}>
            <Plus aria-hidden className="h-4 w-4" />
            Registrar movimiento
          </Button>
        )}
      </div>

      {errorGeneral && !formulario && <Alert tono="error">{errorGeneral}</Alert>}

      <Card>
        <CardHeader titulo="Total del mes" descripcion="Egresos manuales registrados en el mes (el dividendo se registra en el crédito)." />
        <CardBody className="space-y-4">
          <p className="text-2xl font-semibold tabular-nums text-ink">{clp(listado.totalClp)}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {CATEGORIAS_MOVIMIENTO.map((c) => (
              <div key={c}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{ETIQUETA[c]}</dt>
                <dd className="mt-0.5 text-sm tabular-nums">{clp(listado.porCategoria[c])}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {formulario && (
        <Card>
          <CardHeader titulo={formulario.movimiento ? "Editar movimiento" : "Registrar movimiento"} />
          <CardBody>
            <form key={formulario.movimiento?.id ?? "nuevo"} onSubmit={onSubmit} className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <FormField etiqueta="Fecha" requerido errores={errores.fecha}>
                <Input name="fecha" type="date" required max={hoy} defaultValue={formulario.movimiento?.fecha ?? (hoy.startsWith(mes) ? hoy : `${mes}-01`)} />
              </FormField>
              <FormField etiqueta="Categoría" requerido errores={errores.categoria}>
                <Select name="categoria" required defaultValue={formulario.movimiento?.categoria ?? "REPARACION"}>
                  {CATEGORIAS_MOVIMIENTO.map((c) => (
                    <option key={c} value={c}>
                      {ETIQUETA[c]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={desglosar} onChange={(e) => setDesglosar(e.target.checked)} className="h-4 w-4" />
                <span className="font-medium text-ink">Desglosar en conceptos</span>
              </label>

              {desglosar ? (
                <fieldset className="space-y-3 rounded-lg border border-line p-4 sm:col-span-2">
                  <legend className="px-1 text-xs font-medium text-muted">Conceptos (máximo {MAX_CONCEPTOS})</legend>
                  {filas.map((f, i) => (
                    <div key={f.clave} className="grid grid-cols-[1fr_auto] items-start gap-2 text-sm sm:grid-cols-[1fr_10rem_auto]">
                      <div className="col-span-2 sm:col-span-1">
                        <Input
                          aria-label={`Nombre del concepto ${i + 1}`}
                          placeholder="Nombre (ej. Materiales)"
                          type="text"
                          maxLength={MAX_NOMBRE_CONCEPTO}
                          value={f.nombre}
                          onChange={(e) => cambiarFila(f.clave, { nombre: e.target.value })}
                        />
                        {errores[`conceptos.${i}.nombre`]?.map((m) => (
                          <span key={m} role="alert" className="mt-1 block text-xs font-medium text-negative">
                            {m}
                          </span>
                        ))}
                      </div>
                      <div>
                        <Input
                          aria-label={`Monto del concepto ${i + 1} (CLP)`}
                          placeholder="Monto CLP"
                          type="text"
                          inputMode="numeric"
                          value={f.montoClp}
                          onChange={(e) => cambiarFila(f.clave, { montoClp: e.target.value })}
                        />
                        {errores[`conceptos.${i}.montoClp`]?.map((m) => (
                          <span key={m} role="alert" className="mt-1 block text-xs font-medium text-negative">
                            {m}
                          </span>
                        ))}
                      </div>
                      <Button variante="ghost" aria-label={`Quitar concepto ${i + 1}`} onClick={() => quitarFila(f.clave)} disabled={filas.length <= 1} className="h-10 text-negative">
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {errores.conceptos?.map((m) => (
                    <span key={m} role="alert" className="block text-xs font-medium text-negative">
                      {m}
                    </span>
                  ))}
                  {hayFilasInvalidas && (
                    <p className="text-xs text-muted">
                      Cada concepto necesita un nombre y un monto entero mayor que 0. Completa o quita las filas incompletas para poder guardar.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Button variante="secondary" tamano="sm" onClick={agregarFila} disabled={filas.length >= MAX_CONCEPTOS}>
                      <Plus aria-hidden className="h-4 w-4" />
                      Agregar concepto
                    </Button>
                    <span className="text-xs text-muted">
                      {filas.length} de {MAX_CONCEPTOS}
                    </span>
                  </div>
                  <p className="border-t border-line pt-3 text-sm font-semibold tabular-nums">Total: {clp(total)}</p>
                  {errores.montoClp?.map((m) => (
                    <span key={m} role="alert" className="block text-xs font-medium text-negative">
                      {m}
                    </span>
                  ))}
                </fieldset>
              ) : (
                <div className="space-y-3 sm:col-span-2">
                  {descartaDesglose && (
                    <Alert tono="warning">
                      Al guardar se eliminarán los {conceptosPrevios} conceptos de este gasto y quedará como gasto simple. Vuelve a activar «Desglosar en conceptos» para conservarlos.
                    </Alert>
                  )}
                  <FormField etiqueta="Monto (CLP)" requerido errores={errores.montoClp}>
                    <Input name="montoClp" type="text" inputMode="numeric" required value={montoSimple} onChange={(e) => setMontoSimple(e.target.value)} />
                  </FormField>
                </div>
              )}

              <FormField etiqueta="Descripción (opcional)" className="sm:col-span-2">
                <Input name="descripcion" type="text" defaultValue={formulario.movimiento?.descripcion ?? ""} />
              </FormField>

              {errorGeneral && (
                <div className="sm:col-span-2">
                  <Alert tono="error">{errorGeneral}</Alert>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" cargando={enviando} disabled={desglosar && hayFilasInvalidas}>
                  {enviando ? "Guardando…" : "Guardar"}
                </Button>
                <Button variante="secondary" onClick={() => setFormulario(null)} disabled={enviando}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader titulo="Movimientos del mes" />
        {listado.movimientos.length === 0 ? (
          <EmptyState titulo="Sin movimientos en este mes" descripcion="Registra reparaciones, seguros, contribuciones u otros egresos de la propiedad." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Categoría</Th>
                <Th>Descripción</Th>
                <Th alinear="right">Total</Th>
                <Th alinear="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {listado.movimientos.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <Td className="whitespace-nowrap">{fecha(m.fecha)}</Td>
                    <Td>
                      <Badge>{ETIQUETA[m.categoria]}</Badge>
                    </Td>
                    <Td>
                      {m.descripcion ?? "—"}
                      {m.conceptos.length > 0 && (
                        <details className="mt-1 text-xs text-muted">
                          <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-brand">
                            Desglosado en {m.conceptos.length} {m.conceptos.length === 1 ? "concepto" : "conceptos"}
                            <ChevronDown aria-hidden className="h-3 w-3" />
                          </summary>
                          <ul className="mt-1 space-y-0.5">
                            {m.conceptos.map((c) => (
                              <li key={c.id} className="flex justify-between gap-4 tabular-nums">
                                <span>{c.nombre}</span>
                                <span>{clp(c.montoClp)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </Td>
                    <Td numerico className="whitespace-nowrap font-medium">{clp(m.montoClp)}</Td>
                    <Td alinear="right" className="whitespace-nowrap">
                      <Button tamano="sm" variante="ghost" onClick={() => abrir(m)}>
                        Editar
                      </Button>
                      <Button tamano="sm" variante="ghost" className="text-negative hover:text-negative" onClick={() => setAEliminar(m)}>
                        Eliminar
                      </Button>
                    </Td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar movimiento"
        descripcion={
          aEliminar
            ? `Se eliminará el movimiento de ${clp(aEliminar.montoClp)} del ${fecha(aEliminar.fecha)}${aEliminar.conceptos.length > 0 ? ` (con ${aEliminar.conceptos.length} conceptos)` : ""}. Esta acción no se puede deshacer.`
            : undefined
        }
        cargando={eliminando}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={eliminar}
      />
    </div>
  );
}
