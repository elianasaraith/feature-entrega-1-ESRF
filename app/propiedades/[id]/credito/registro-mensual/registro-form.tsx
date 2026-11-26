"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistroMensualDto } from "@/server/services/credito-registro-service";
import { Alert, Button, ButtonLink, FormField, Input } from "../../../../_ui";

type Props = { propiedadId: string; registro?: RegistroMensualDto };

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
    if (enviando) return;
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField etiqueta="Período (mensualidad hipotecaria)" errores={errores.periodo} requerido>
        <Input
          name="periodo"
          type="month"
          required
          readOnly={Boolean(registro)}
          defaultValue={registro?.periodo ?? ""}
          aria-invalid={errores.periodo ? true : undefined}
        />
      </FormField>
      <FormField etiqueta="Dividendo pagado (CLP, opcional)" errores={errores.dividendoPagadoClp}>
        <Input
          name="dividendoPagadoClp"
          type="text"
          inputMode="numeric"
          value={dividendo}
          onChange={(e) => setDividendo(e.target.value)}
          aria-invalid={errores.dividendoPagadoClp ? true : undefined}
        />
      </FormField>
      {dividendo.trim() !== "" && (
        <FormField etiqueta="Fecha de pago del dividendo" errores={errores.fechaPagoDividendo} requerido>
          <Input
            name="fechaPagoDividendo"
            type="date"
            required
            defaultValue={registro?.fechaPagoDividendo ?? ""}
            aria-invalid={errores.fechaPagoDividendo ? true : undefined}
          />
        </FormField>
      )}
      <FormField etiqueta="Saldo pendiente informado por el banco (UF, opcional)" errores={errores.saldoPendienteUf}>
        <Input
          name="saldoPendienteUf"
          type="text"
          inputMode="decimal"
          defaultValue={registro?.saldoPendienteUf ?? ""}
          aria-invalid={errores.saldoPendienteUf ? true : undefined}
        />
      </FormField>
      {dividendo.trim() === "" &&
        errores.fechaPagoDividendo?.map((mensaje) => (
          <p key={mensaje} role="alert" className="text-xs font-medium text-negative">
            {mensaje}
          </p>
        ))}
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink href={`/propiedades/${propiedadId}/credito/registro-mensual`} variante="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
