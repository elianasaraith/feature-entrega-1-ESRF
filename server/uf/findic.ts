import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ProveedorUf, ResultadoUf } from "./proveedor";

// Cliente HTTP de findic.cl: GET {base}/{dd-mm-yyyy}. Responde
// {"serie":[{"fecha":"YYYY-MM-DD","valor":39796.31}]}, o "serie": [] sin datos.
// `valor` llega como número JSON: se valida con Zod y se convierte de inmediato
// a Prisma.Decimal; ninguna operación monetaria se hace con `number`.
export const FUENTE_FINDIC = "findic.cl";
export const UF_API_URL_POR_DEFECTO = "https://findic.cl/api/uf";
export const UF_TIMEOUT_MS = 5000;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
// NUMERIC(12,2): como máximo 10 dígitos enteros.
const LIMITE_EXCLUSIVO = new Prisma.Decimal("10000000000");

const cuerpoSchema = z.object({ serie: z.array(z.unknown()) });
const elementoSchema = z.object({
  fecha: z.string(),
  valor: z.number().positive(),
});

type Opciones = {
  baseUrl?: string;
  timeoutMs?: number;
  // Inyectable para pruebas; por defecto el fetch nativo.
  fetchFn?: typeof fetch;
};

export function createFindicProveedor(opciones: Opciones = {}): ProveedorUf {
  const baseUrl = (opciones.baseUrl ?? process.env.UF_API_BASE_URL ?? UF_API_URL_POR_DEFECTO)
    .trim()
    .replace(/\/+$/, "");
  const timeoutMs = opciones.timeoutMs ?? UF_TIMEOUT_MS;
  const fetchFn = opciones.fetchFn ?? fetch;

  return {
    fuente: FUENTE_FINDIC,

    async obtener(fecha: string): Promise<ResultadoUf> {
      const partes = FECHA.exec(fecha);
      if (!partes) return { tipo: "error", motivo: "fecha solicitada inválida" };
      const url = `${baseUrl}/${partes[3]}-${partes[2]}-${partes[1]}`;

      // El timeout cubre la respuesta completa (cabeceras y cuerpo). Se usa un
      // AbortController con temporizador propio para poder cancelarlo al terminar.
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), timeoutMs);
      let json: unknown;
      try {
        const respuesta = await fetchFn(url, {
          cache: "no-store",
          headers: { accept: "application/json" },
          signal: control.signal,
        });
        if (!respuesta.ok) {
          return { tipo: "error", motivo: `HTTP ${respuesta.status}` };
        }
        try {
          json = await respuesta.json();
        } catch {
          return { tipo: "error", motivo: "cuerpo no es JSON válido (o timeout)" };
        }
      } catch {
        return { tipo: "error", motivo: "sin respuesta del proveedor (red o timeout)" };
      } finally {
        clearTimeout(temporizador);
      }

      const cuerpo = cuerpoSchema.safeParse(json);
      if (!cuerpo.success) return { tipo: "error", motivo: "estructura de respuesta inválida" };
      const { serie } = cuerpo.data;
      if (serie.length === 0) return { tipo: "sin-datos" };
      if (serie.length !== 1) return { tipo: "error", motivo: "la serie no tiene un único valor" };

      const elemento = elementoSchema.safeParse(serie[0]);
      if (!elemento.success) return { tipo: "error", motivo: "valor de la UF inválido" };
      if (elemento.data.fecha !== fecha) {
        return { tipo: "error", motivo: "la fecha de la respuesta no coincide con la solicitada" };
      }

      // Único uso del `number` recibido: su representación textual más corta.
      const valor = new Prisma.Decimal(String(elemento.data.valor));
      if (!valor.isFinite() || valor.decimalPlaces() > 2 || valor.gte(LIMITE_EXCLUSIVO)) {
        return { tipo: "error", motivo: "valor de la UF fuera de precisión o rango" };
      }
      return { tipo: "ok", valorClp: valor, fechaValor: fecha };
    },
  };
}
