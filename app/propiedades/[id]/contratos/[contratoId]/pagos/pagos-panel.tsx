"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clp, fecha } from "../../../../../_lib/format";
import { Alert, BadgeEstadoPago, Button, Card, CardBody, ConfirmDialog, DataTable, EmptyState, FormField, Input, Td, Th } from "../../../../../_ui";
import type { AbonoDto, PagoDto } from "@/server/services/pago-service";

type Props = { propiedadId: string; contratoId: string; hoy: string; pagos: PagoDto[] };


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
    if (!formulario || enviando) return;
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

  const [aEliminar, setAEliminar] = useState<{ pagoId: string; abono: AbonoDto } | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    if (!aEliminar) return;
    const { pagoId, abono } = aEliminar;
    setErrorGeneral(null);
    setEliminando(true);
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
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  if (pagos.length === 0) {
    return (
      <Card>
        <EmptyState titulo="Sin pagos esperados" descripcion="Este contrato aún no tiene pagos esperados. Créelos desde Montos con «Sincronizar pagos esperados»." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {errorGeneral && !formulario && <Alert tono="error">{errorGeneral}</Alert>}
      {pagos.map((p) => {
        const vencida = p.fechaEsperada < hoy && p.estado !== "PAGADO";
        return (
          <Card key={p.id}>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">{p.periodo.slice(0, 7)}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeEstadoPago estado={p.estado} />
                  {p.vencidoConAbonosParciales && <span className="text-xs text-muted">con abonos parciales</span>}
                  {p.pagadoConAtraso && <span className="text-xs text-muted">con atraso</span>}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Esperado</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">{clp(p.montoEsperadoClp)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Recibido</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-positive">{clp(p.recibidoClp)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Saldo pendiente</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">{clp(p.saldoPendienteClp)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Fecha esperada{vencida ? " (vencida)" : ""}</dt>
                  <dd className={`mt-1 text-sm ${vencida ? "font-medium text-negative" : ""}`}>
                    {fecha(p.fechaEsperada)}
                    {p.fechaCompletitud && <span className="block text-xs text-muted">Completado el {fecha(p.fechaCompletitud)}</span>}
                  </dd>
                </div>
              </dl>

              {p.abonos.length > 0 && (
                <div className="rounded-lg border border-line">
                  <DataTable>
                    <caption className="sr-only">Abonos del período {p.periodo.slice(0, 7)}</caption>
                    <thead>
                      <tr>
                        <Th>Recepción</Th>
                        <Th alinear="right">Monto</Th>
                        <Th>Medio</Th>
                        <Th alinear="right">Acciones</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.abonos.map((a) => (
                        <tr key={a.id}>
                          <Td className="whitespace-nowrap">{fecha(a.fechaRecepcion)}</Td>
                          <Td numerico>{clp(a.montoClp)}</Td>
                          <Td>{a.medio ?? "—"}</Td>
                          <Td alinear="right" className="whitespace-nowrap">
                            <Button tamano="sm" variante="ghost" onClick={() => abrir(p.id, a)}>
                              Editar
                            </Button>
                            <Button tamano="sm" variante="ghost" className="text-negative hover:text-negative" onClick={() => setAEliminar({ pagoId: p.id, abono: a })}>
                              Eliminar
                            </Button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              )}

              {formulario?.pagoId === p.id ? (
                <form
                  key={formulario.abono?.id ?? "nuevo"}
                  onSubmit={onSubmit}
                  className="grid gap-4 rounded-lg border border-line bg-canvas/50 p-4 sm:grid-cols-3"
                >
                  <h3 className="text-sm font-semibold sm:col-span-3">{formulario.abono ? "Editar abono" : "Registrar abono"}</h3>
                  <FormField etiqueta="Monto (CLP)" requerido errores={errores.montoClp}>
                    <Input name="montoClp" type="text" inputMode="numeric" required defaultValue={formulario.abono?.montoClp ?? ""} />
                  </FormField>
                  <FormField etiqueta="Fecha de recepción" requerido errores={errores.fechaRecepcion}>
                    <Input name="fechaRecepcion" type="date" required max={hoy} defaultValue={formulario.abono?.fechaRecepcion ?? hoy} />
                  </FormField>
                  <FormField etiqueta="Medio (opcional)">
                    <Input name="medio" type="text" placeholder="Transferencia, depósito, efectivo" defaultValue={formulario.abono?.medio ?? ""} />
                  </FormField>
                  {errorGeneral && (
                    <div className="sm:col-span-3">
                      <Alert tono="error">{errorGeneral}</Alert>
                    </div>
                  )}
                  <div className="flex gap-2 sm:col-span-3">
                    <Button type="submit" cargando={enviando}>
                      {enviando ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button variante="secondary" onClick={() => setFormulario(null)} disabled={enviando}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <Button variante="secondary" tamano="sm" onClick={() => abrir(p.id, null)}>
                    Registrar abono
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar abono"
        descripcion={aEliminar ? `Se eliminará el abono de ${clp(aEliminar.abono.montoClp)} del ${fecha(aEliminar.abono.fechaRecepcion)}. Esta acción no se puede deshacer.` : undefined}
        cargando={eliminando}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={eliminar}
      />
    </div>
  );
}
