"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditoDto } from "@/server/services/credito-service";
import { Alert, Button, ButtonLink, FormField, Input } from "../../../_ui";

type Props = { propiedadId: string; credito?: CreditoDto };

export function CreditoForm({ propiedadId, credito }: Props) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const cuerpo = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const respuesta = await fetch(`/api/propiedades/${propiedadId}/credito`, {
        method: credito ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        setErrores(datos?.campos ?? {});
        setErrorGeneral(datos?.campos ? null : (datos?.error ?? "No se pudo guardar"));
        return;
      }
      router.push(`/propiedades/${propiedadId}/credito`);
      router.refresh();
    } catch {
      setErrorGeneral("No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  function campo(
    nombre: string,
    etiqueta: string,
    opciones: {
      type?: string;
      requerido?: boolean;
      valor?: string | number | null;
      ayuda?: string;
    } = {}
  ) {
    return (
      <FormField
        etiqueta={etiqueta}
        errores={errores[nombre]}
        requerido={opciones.requerido}
        ayuda={opciones.ayuda}
      >
        <Input
          name={nombre}
          type={opciones.type ?? "text"}
          inputMode={opciones.type ? undefined : "decimal"}
          required={opciones.requerido}
          defaultValue={opciones.valor ?? ""}
          aria-invalid={errores[nombre] ? true : undefined}
        />
      </FormField>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField etiqueta="Banco" errores={errores.banco} requerido>
        <Input
          name="banco"
          type="text"
          required
          defaultValue={credito?.banco ?? ""}
          aria-invalid={errores.banco ? true : undefined}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("cuotaContractualUf", "Cuota contractual (UF)", {
          requerido: true,
          valor: credito?.cuotaContractualUf,
        })}
        {campo("tasaInteresAnual", "Tasa de interés anual (%)", {
          requerido: true,
          valor: credito?.tasaInteresAnual,
        })}
        {campo("numeroCuotasTotal", "Número total de cuotas", {
          type: "number",
          requerido: true,
          valor: credito?.numeroCuotasTotal,
        })}
        {campo("diaVencimiento", "Día de vencimiento (1–31)", {
          type: "number",
          requerido: true,
          valor: credito?.diaVencimiento,
        })}
        {campo("numeroCredito", "Número de crédito (opcional)", { type: "text", valor: credito?.numeroCredito })}
        {campo("fechaOtorgamiento", "Fecha de otorgamiento (opcional)", {
          type: "date",
          valor: credito?.fechaOtorgamiento,
        })}
        {campo("montoOriginalUf", "Monto original (UF, opcional)", { valor: credito?.montoOriginalUf })}
        {campo("segurosUf", "Seguros (UF, opcional)", { valor: credito?.segurosUf })}
        {campo("saldoInicialUf", "Saldo inicial (UF, opcional)", { valor: credito?.saldoInicialUf })}
        {campo("porcentajePie", "Porcentaje de pie (%)", {
          valor: credito?.porcentajePie,
          ayuda: "Porcentaje del valor de compra aportado como pago inicial.",
        })}
      </div>
      {errorGeneral && <Alert tono="error">{errorGeneral}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" cargando={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink href={`/propiedades/${propiedadId}/credito`} variante="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
