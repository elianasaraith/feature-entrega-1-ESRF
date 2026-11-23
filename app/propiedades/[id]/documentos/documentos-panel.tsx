"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentoDto } from "@/server/services/documento-service";

type Props = {
  propiedadId: string;
  documentos: DocumentoDto[];
  creditoId: string | null;
  contratos: { id: string; etiqueta: string }[];
};

const TIPOS: [string, string][] = [
  ["ESCRITURA", "Escritura"],
  ["CONTRATO_HIPOTECARIO", "Contrato hipotecario"],
  ["CONTRATO_ARRIENDO", "Contrato de arriendo"],
  ["COMPROBANTE_PAGO", "Comprobante de pago"],
  ["FACTURA", "Factura"],
  ["OTRO", "Otro"],
];
const ETIQUETA_TIPO = Object.fromEntries(TIPOS);
const ETIQUETA_VINCULO: Record<string, string> = {
  CREDITO: "Crédito",
  CONTRATO: "Contrato",
  ABONO: "Abono",
  MOVIMIENTO: "Movimiento",
};
const inputClass = "w-full rounded border px-2 py-1";

function tamanoLegible(bytes: string): string {
  const n = Number(bytes);
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Flujo de subida: 1) pedir URL firmada, 2) subir directo al bucket, 3) registrar
// la metadata. El binario nunca pasa por la aplicación.
export function DocumentosPanel({ propiedadId, documentos, creditoId, contratos }: Props) {
  const router = useRouter();
  const base = `/api/propiedades/${propiedadId}/documentos`;
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const datos = new FormData(formulario);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setError("Seleccione un archivo");
      return;
    }
    setEnviando(true);
    setError(null);
    const [vTipo, vId] = String(datos.get("vinculo") ?? "").split(":");
    const cuerpo = {
      tipo: datos.get("tipo"),
      nombreArchivo: archivo.name,
      mimeType: archivo.type,
      tamanoBytes: archivo.size,
      vinculo: vTipo ? { tipo: vTipo, id: vId } : null,
    };
    try {
      const paso1 = await fetch(`${base}/subida`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
      const r1 = await paso1.json().catch(() => null);
      if (!paso1.ok) {
        setError(mensajeDe(r1));
        return;
      }
      const subida = await fetch(r1.subida.url, { method: "PUT", headers: r1.subida.headers, body: archivo });
      if (!subida.ok) {
        setError("No se pudo subir el archivo al almacenamiento");
        return;
      }
      const paso3 = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...cuerpo, storageKey: r1.storageKey, tokenSubida: r1.tokenSubida }) });
      const r3 = await paso3.json().catch(() => null);
      if (!paso3.ok) {
        setError(mensajeDe(r3));
        return;
      }
      formulario.reset();
      router.refresh();
    } catch {
      setError("No se pudo completar la subida");
    } finally {
      setEnviando(false);
    }
  }

  function mensajeDe(r: { error?: string; campos?: Record<string, string[]> } | null): string {
    const campo = r?.campos ? Object.values(r.campos)[0]?.[0] : undefined;
    return campo ?? r?.error ?? "No se pudo completar la operación";
  }

  async function descargar(id: string) {
    setError(null);
    const r = await fetch(`${base}/${id}`);
    const datos = await r.json().catch(() => null);
    if (!r.ok) {
      setError(mensajeDe(datos));
      return;
    }
    window.open(datos.url, "_blank", "noopener");
  }

  async function eliminar(d: DocumentoDto) {
    if (!window.confirm(`¿Eliminar «${d.nombreArchivo}»?`)) return;
    setError(null);
    const r = await fetch(`${base}/${d.id}`, { method: "DELETE" });
    if (!r.ok) {
      setError(mensajeDe(await r.json().catch(() => null)));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Subir documento</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Archivo (PDF, JPEG, PNG o WebP, máx. 20 MB)</span>
            <input name="archivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo</span>
            <select name="tipo" defaultValue="OTRO" className={inputClass}>
              {TIPOS.map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Asociado a</span>
            <select name="vinculo" defaultValue="" className={inputClass}>
              <option value="">Solo la propiedad</option>
              {creditoId && <option value={`CREDITO:${creditoId}`}>Crédito hipotecario</option>}
              {contratos.map((c) => (
                <option key={c.id} value={`CONTRATO:${c.id}`}>
                  Contrato: {c.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={enviando} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {enviando ? "Subiendo…" : "Subir"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Documentos de la propiedad</h2>
        {documentos.length === 0 ? (
          <p className="text-sm">Aún no hay documentos.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Archivo</th>
                <th>Tipo</th>
                <th>Asociado a</th>
                <th>Tamaño</th>
                <th>Subido</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="py-2">{d.nombreArchivo}</td>
                  <td>{ETIQUETA_TIPO[d.tipo]}</td>
                  <td>{d.vinculo ? ETIQUETA_VINCULO[d.vinculo.tipo] : "Propiedad"}</td>
                  <td>{tamanoLegible(d.tamanoBytes)}</td>
                  <td>{d.subidoEn.slice(0, 10)}</td>
                  <td>
                    <button type="button" onClick={() => descargar(d.id)} className="underline">
                      Descargar
                    </button>
                    <button type="button" onClick={() => eliminar(d)} className="ml-3 underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
