"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Card, CardBody, FormField, Input, Select, Textarea } from "../../../_ui";
import type { ArrendatarioDto } from "@/server/services/arrendatario-service";
import type { ContratoDto } from "@/server/services/contrato-service";

type Props = {
  propiedadId: string;
  arrendatarios: ArrendatarioDto[];
  contrato?: ContratoDto;
};

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

  const radio = "flex cursor-pointer items-center gap-2 text-sm font-medium text-ink";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-base font-semibold text-ink">Arrendatario</h2>
          {!contrato && (
            <div role="radiogroup" aria-label="Tipo de arrendatario" className="flex flex-wrap gap-6">
              <label className={radio}>
                <input type="radio" name="tipoArr" checked={!nuevo} onChange={() => setNuevo(false)} /> Existente
              </label>
              <label className={radio}>
                <input type="radio" name="tipoArr" checked={nuevo} onChange={() => setNuevo(true)} /> Nuevo
              </label>
            </div>
          )}
          {nuevo && !contrato ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField etiqueta="Nombre del arrendatario" requerido errores={errores["arrendatario.nombre"]} className="sm:col-span-2">
                <Input name="arrNombre" type="text" required />
              </FormField>
              <FormField etiqueta="RUT (opcional)" errores={errores["arrendatario.rut"]}>
                <Input name="arrRut" type="text" />
              </FormField>
              <FormField etiqueta="Teléfono (opcional)">
                <Input name="arrTelefono" type="text" />
              </FormField>
              <FormField etiqueta="Email (opcional)" className="sm:col-span-2">
                <Input name="arrEmail" type="text" />
              </FormField>
            </div>
          ) : (
            <FormField etiqueta="Arrendatario" requerido errores={errores.arrendatarioId}>
              <Select name="arrendatarioId" required defaultValue={contrato?.arrendatario.id ?? ""}>
                <option value="" disabled>
                  Seleccione…
                </option>
                {arrendatarios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.rut ? ` (${a.rut})` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <h2 className="text-base font-semibold text-ink sm:col-span-2">Condiciones del contrato</h2>
          <FormField etiqueta="Fecha de inicio" requerido errores={errores.fechaInicio}>
            <Input name="fechaInicio" type="date" required defaultValue={contrato?.fechaInicio ?? ""} />
          </FormField>
          <FormField etiqueta="Fecha de término" requerido errores={errores.fechaTermino}>
            <Input name="fechaTermino" type="date" required defaultValue={contrato?.fechaTermino ?? ""} />
          </FormField>
          <FormField etiqueta="Día esperado de pago (1 a 31)" requerido errores={errores.diaEsperadoPago}>
            <Input name="diaEsperadoPago" type="number" min={1} max={31} required defaultValue={contrato?.diaEsperadoPago ?? ""} />
          </FormField>
          {!contrato && (
            <FormField etiqueta="Monto mensual inicial (CLP, opcional)" errores={errores.montoMensualClp}>
              <Input name="montoMensualClp" type="text" inputMode="numeric" />
            </FormField>
          )}
          <FormField
            etiqueta="Garantía (CLP, opcional)"
            ayuda="Dato contractual, no constituye ingreso."
            errores={errores.garantiaClp}
            className="sm:col-span-2"
          >
            <Input name="garantiaClp" type="text" inputMode="numeric" defaultValue={contrato?.garantiaClp ?? ""} />
          </FormField>
          <FormField etiqueta="Observaciones (opcional)" className="sm:col-span-2">
            <Textarea name="observaciones" rows={3} defaultValue={contrato?.observaciones ?? ""} />
          </FormField>
        </CardBody>
      </Card>

      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink href={`/propiedades/${propiedadId}/contratos`} variante="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
