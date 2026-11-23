// Reglas de formato y tamaño de los documentos (T11). Los documentos de diseño no
// los fijan: son supuestos a validar y viven aquí, en un único lugar.
export const TIPOS_DOCUMENTO = [
  "ESCRITURA",
  "CONTRATO_HIPOTECARIO",
  "CONTRATO_ARRIENDO",
  "COMPROBANTE_PAGO",
  "FACTURA",
  "OTRO",
] as const;
export type TipoDocumentoValor = (typeof TIPOS_DOCUMENTO)[number];

export const MIME_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

// null si el archivo es aceptable; si no, el motivo.
export function errorDeArchivo(mimeType: string, tamanoBytes: number): string | null {
  if (!(MIME_PERMITIDOS as readonly string[]).includes(mimeType)) {
    return "Formato no permitido: use PDF, JPEG, PNG o WebP";
  }
  if (!Number.isInteger(tamanoBytes) || tamanoBytes <= 0) return "El tamaño debe ser mayor que 0";
  if (tamanoBytes > TAMANO_MAXIMO_BYTES) return "El archivo excede el máximo de 20 MB";
  return null;
}

export const prefijoClave = (propiedadId: string) => `propiedades/${propiedadId}/`;

// Bytes iniciales que debe leer el servidor para comprobar el formato real.
export const BYTES_FIRMA = 12;

const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((v, i) => b[desde + i] === v);

// El contenido real coincide con el tipo declarado (no se confía en el cliente):
// PDF "%PDF-", JPEG FF D8 FF, PNG 89 "PNG" CR LF 1A LF, WebP "RIFF" .... "WEBP".
export function coincideFirma(mimeType: string, inicio: Uint8Array): boolean {
  switch (mimeType) {
    case "application/pdf":
      return empieza(inicio, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "image/jpeg":
      return empieza(inicio, [0xff, 0xd8, 0xff]);
    case "image/png":
      return empieza(inicio, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return empieza(inicio, [0x52, 0x49, 0x46, 0x46]) && empieza(inicio, [0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

// Content-Type sin parámetros y en minúsculas, para compararlo con el declarado.
export const tipoBase = (contentType: string | null) => (contentType ?? "").split(";")[0].trim().toLowerCase();
