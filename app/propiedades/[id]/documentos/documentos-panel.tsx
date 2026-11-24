"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileImage, FileText, File as FileIcon, Download, Trash2, UploadCloud } from "lucide-react";
import { fecha } from "../../../_lib/format";
import { cn } from "../../../_lib/cn";
import { Alert, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, DataTable, EmptyState, FormField, Select, Td, Th } from "../../../_ui";
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
const FORMATOS = "PDF, JPEG, PNG o WebP · máx. 20 MB";

function IconoArchivo({ nombre }: { nombre: string }) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  const cls = "h-5 w-5 shrink-0";
  if (ext === "pdf") return <FileText aria-hidden className={cn(cls, "text-negative")} />;
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return <FileImage aria-hidden className={cn(cls, "text-brand")} />;
  return <FileIcon aria-hidden className={cn(cls, "text-muted")} />;
}

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
  const [paso, setPaso] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [aEliminar, setAEliminar] = useState<DocumentoDto | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    const formulario = event.currentTarget;
    const datos = new FormData(formulario);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setError("Seleccione un archivo");
      return;
    }
    setEnviando(true);
    setError(null);
    setPaso("Solicitando URL de subida…");
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
      setPaso("Subiendo archivo…");
      const subida = await fetch(r1.subida.url, { method: "PUT", headers: r1.subida.headers, body: archivo });
      if (!subida.ok) {
        setError("No se pudo subir el archivo al almacenamiento");
        return;
      }
      setPaso("Registrando documento…");
      const paso3 = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...cuerpo, storageKey: r1.storageKey, tokenSubida: r1.tokenSubida }) });
      const r3 = await paso3.json().catch(() => null);
      if (!paso3.ok) {
        setError(mensajeDe(r3));
        return;
      }
      formulario.reset();
      setArchivoNombre(null);
      router.refresh();
    } catch {
      setError("No se pudo completar la subida");
    } finally {
      setEnviando(false);
      setPaso(null);
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

  async function eliminar() {
    if (!aEliminar) return;
    setError(null);
    setEliminando(true);
    try {
      const r = await fetch(`${base}/${aEliminar.id}`, { method: "DELETE" });
      if (!r.ok) {
        setError(mensajeDe(await r.json().catch(() => null)));
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo eliminar el documento");
    } finally {
      setEliminando(false);
      setAEliminar(null);
    }
  }

  function alSoltar(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastrando(false);
    const archivos = e.dataTransfer.files;
    if (archivos.length > 0 && inputRef.current) {
      inputRef.current.files = archivos;
      setArchivoNombre(archivos[0].name);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader titulo="Subir documento" descripcion={`Formatos aceptados: ${FORMATOS}`} />
        <CardBody>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-brand sm:col-span-2",
                arrastrando ? "border-brand bg-brand-50" : "border-line bg-canvas/50 hover:border-brand/60"
              )}
            >
              <UploadCloud aria-hidden className="h-8 w-8 text-brand" />
              <span className="text-sm font-medium text-ink">
                {archivoNombre ?? "Arrastra un archivo aquí o haz clic para seleccionarlo"}
              </span>
              <span className="text-xs text-muted">{FORMATOS}</span>
              <input
                ref={inputRef}
                name="archivo"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                required
                className="sr-only"
                onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            <FormField etiqueta="Tipo">
              <Select name="tipo" defaultValue="OTRO">
                {TIPOS.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField etiqueta="Asociado a">
              <Select name="vinculo" defaultValue="">
                <option value="">Solo la propiedad</option>
                {creditoId && <option value={`CREDITO:${creditoId}`}>Crédito hipotecario</option>}
                {contratos.map((c) => (
                  <option key={c.id} value={`CONTRATO:${c.id}`}>
                    Contrato: {c.etiqueta}
                  </option>
                ))}
              </Select>
            </FormField>
            {error && (
              <div className="sm:col-span-2">
                <Alert tono="error">{error}</Alert>
              </div>
            )}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" cargando={enviando}>
                {enviando ? "Subiendo…" : "Subir"}
              </Button>
              {paso && (
                <span role="status" className="text-sm text-muted">
                  {paso}
                </span>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Documentos de la propiedad" />
        {documentos.length === 0 ? (
          <EmptyState titulo="Aún no hay documentos" descripcion="Sube escrituras, contratos, comprobantes o facturas de esta propiedad." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Archivo</Th>
                <Th>Tipo</Th>
                <Th>Asociado a</Th>
                <Th alinear="right">Tamaño</Th>
                <Th>Subido</Th>
                <Th alinear="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <span className="flex items-center gap-2 font-medium">
                      <IconoArchivo nombre={d.nombreArchivo} />
                      <span className="break-all">{d.nombreArchivo}</span>
                    </span>
                  </Td>
                  <Td>
                    <Badge>{ETIQUETA_TIPO[d.tipo]}</Badge>
                  </Td>
                  <Td>{d.vinculo ? ETIQUETA_VINCULO[d.vinculo.tipo] : "Propiedad"}</Td>
                  <Td numerico className="whitespace-nowrap">{tamanoLegible(d.tamanoBytes)}</Td>
                  <Td className="whitespace-nowrap">{fecha(d.subidoEn)}</Td>
                  <Td alinear="right" className="whitespace-nowrap">
                    <Button tamano="sm" variante="ghost" onClick={() => descargar(d.id)}>
                      <Download aria-hidden className="h-3.5 w-3.5" />
                      Descargar
                    </Button>
                    <Button tamano="sm" variante="ghost" className="text-negative hover:text-negative" onClick={() => setAEliminar(d)}>
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar documento"
        descripcion={aEliminar ? `Se eliminará «${aEliminar.nombreArchivo}». Esta acción no se puede deshacer.` : undefined}
        cargando={eliminando}
        onCancelar={() => setAEliminar(null)}
        onConfirmar={eliminar}
      />
    </div>
  );
}
