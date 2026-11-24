"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clp } from "../../../../../_lib/format";
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, DataTable, EmptyState, FormField, Input, Td, Th } from "../../../../../_ui";
import type { MontoDto } from "@/server/services/contrato-service";

type Props = {
  propiedadId: string;
  contratoId: string;
  fechaInicio: string;
  fechaTermino: string;
  montos: MontoDto[];
  montoVigenteClp: string | null;
};

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [errorFila, setErrorFila] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<MontoDto | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Corrección (PUT) o eliminación (DELETE) de una fila. El servidor decide: si hay
  // abonos en el rango responde 422 y no cambia nada.
  async function modificarMonto(montoId: string, metodo: "PUT" | "DELETE", monto?: string) {
    setErrorFila(null);
    setProcesando(true);
    try {
      const respuesta = await fetch(`${base}/montos/${montoId}`, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: metodo === "PUT" ? JSON.stringify({ montoMensualClp: monto }) : undefined,
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrorFila(datos?.campos?.montoMensualClp?.[0] ?? datos?.error ?? "No se pudo modificar el monto");
        return;
      }
      setEditandoId(null);
      setAEliminar(null);
      router.refresh();
    } catch {
      setErrorFila("No se pudo modificar el monto");
    } finally {
      setProcesando(false);
      setAEliminar(null);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          titulo="Historial de montos"
          descripcion={!primero ? <>Monto vigente este mes: <strong className="text-ink">{montoVigenteClp ? `${clp(montoVigenteClp)} CLP` : "—"}</strong></> : undefined}
        />
        {primero ? (
          <EmptyState titulo="Sin monto registrado" descripcion="Este contrato aún no tiene monto. Registre el primero más abajo." />
        ) : (
          <>
            <DataTable>
              <thead>
                <tr>
                  <Th>Rige desde</Th>
                  <Th alinear="right">Monto (CLP)</Th>
                  <Th>Motivo</Th>
                  <Th alinear="right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {montos.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap">{m.vigenteDesdePeriodo.slice(0, 7)}</Td>
                    <Td numerico>
                      {editandoId === m.id ? (
                        <form
                          className="flex items-center justify-end gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const nuevo = new FormData(e.currentTarget).get("monto");
                            void modificarMonto(m.id, "PUT", String(nuevo ?? ""));
                          }}
                        >
                          <Input name="monto" type="text" inputMode="numeric" aria-label="Nuevo monto (CLP)" defaultValue={m.montoMensualClp} className="w-32" />
                          <Button type="submit" tamano="sm" cargando={procesando}>
                            Guardar
                          </Button>
                          <Button type="button" tamano="sm" variante="ghost" onClick={() => setEditandoId(null)} disabled={procesando}>
                            Cancelar
                          </Button>
                        </form>
                      ) : (
                        clp(m.montoMensualClp)
                      )}
                    </Td>
                    <Td>{m.motivo ?? "—"}</Td>
                    <Td alinear="right" className="whitespace-nowrap">
                      <Button tamano="sm" variante="ghost" onClick={() => { setErrorFila(null); setEditandoId(m.id); }}>
                        Corregir
                      </Button>
                      {m !== montos[0] && (
                        <Button tamano="sm" variante="ghost" className="text-negative hover:text-negative" onClick={() => setAEliminar(m)}>
                          Eliminar
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {errorFila && (
              <div className="p-4">
                <Alert tono="error">{errorFila}</Alert>
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHeader titulo={primero ? "Registrar primer monto" : "Registrar reajuste"} />
        <CardBody>
          <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 sm:grid-cols-2">
            {primero ? (
              <p className="text-sm text-muted sm:col-span-2">Regirá desde {fechaInicio.slice(0, 7)} (mes de inicio del contrato).</p>
            ) : (
              <FormField
                etiqueta="Rige desde (mes)"
                requerido
                ayuda={`Entre ${fechaInicio.slice(0, 7)} y ${fechaTermino.slice(0, 7)}`}
                errores={errores.vigenteDesdePeriodo}
              >
                <Input name="vigenteDesdePeriodo" type="month" required />
              </FormField>
            )}
            <FormField etiqueta="Monto mensual (CLP)" requerido errores={errores.montoMensualClp}>
              <Input name="montoMensualClp" type="text" inputMode="numeric" required />
            </FormField>
            <FormField etiqueta="Motivo (opcional)" className="sm:col-span-2">
              <Input name="motivo" type="text" />
            </FormField>
            <div className="sm:col-span-2">
              <Button type="submit" cargando={enviando}>
                {enviando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          titulo="Pagos esperados"
          descripcion="Crea los pagos esperados que faltan, desde el inicio del contrato hasta el mes en curso. Se puede repetir sin efectos duplicados."
        />
        <CardBody className="space-y-3">
          <Button variante="secondary" onClick={sincronizar} cargando={sincronizando} disabled={primero}>
            {sincronizando ? "Sincronizando…" : "Sincronizar pagos esperados"}
          </Button>
          {primero && <p className="text-sm text-muted">Registre primero el monto del contrato.</p>}
          {resultado && <Alert tono="success">{resultado}</Alert>}
        </CardBody>
      </Card>

      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar reajuste"
        descripcion={aEliminar ? `Se eliminará el reajuste de ${aEliminar.vigenteDesdePeriodo.slice(0, 7)}. Si existen abonos en ese rango, la operación será rechazada.` : undefined}
        cargando={procesando}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={() => aEliminar && void modificarMonto(aEliminar.id, "DELETE")}
      />
    </div>
  );
}
