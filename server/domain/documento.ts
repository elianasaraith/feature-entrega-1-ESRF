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

// --- Subida en dos fases (seguridad-mvp, design.md D9-D11) ---------------------------
// El navegador solo recibe permiso de escritura sobre una clave TEMPORAL; el backend
// valida el objeto y lo promueve a una clave DEFINITIVA distinta (`propiedades/...`, el
// formato de siempre) sobre la que el navegador nunca tiene URL de escritura.
const UUID_PARTE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const prefijoTemporal = (propiedadId: string) => `tmp/propiedades/${propiedadId}/`;
export const claveTemporal = (propiedadId: string, uuid: string) => `${prefijoTemporal(propiedadId)}${uuid}`;
export const claveDefinitiva = (propiedadId: string, uuid: string) => `${prefijoClave(propiedadId)}${uuid}`;
// Forma exacta `tmp/propiedades/{propiedadId}/{uuid}`: sin segmentos extra ni `..`.
export function esClaveTemporalDe(clave: string, propiedadId: string): boolean {
  const m = new RegExp(`^tmp/propiedades/(${UUID_PARTE})/(${UUID_PARTE})$`, "i").exec(clave);
  return m !== null && m[1].toLowerCase() === propiedadId.toLowerCase();
}

// Cuotas de la demostración. Parámetros únicos.
export const MAX_DOCUMENTOS_PROPIEDAD = 50;
export const MAX_BYTES_PROPIEDAD = 200 * 1024 * 1024;
export const MAX_BYTES_GLOBAL = 1024 * 1024 * 1024;
// Vigencia de la reserva (y del token de subida): la URL firmada dura 5 min y el
// registro debe seguirla.
export const VIDA_RESERVA_SEGUNDOS = 600;
// Una confirmación EN_PROCESO sin completarse se puede reclamar de nuevo pasado este plazo.
export const RECLAMO_ABANDONADO_SEGUNDOS = 60;
// Margen tras el vencimiento antes de borrar objetos de una reserva (no pisar confirmaciones en curso).
export const MARGEN_LIMPIEZA_SEGUNDOS = 300;
export const COMPLETADAS_RETENCION_SEGUNDOS = 24 * 60 * 60;
export const LIMPIEZA_LOTE = 20;

export type UsoDocumentos = { documentosPropiedad: number; bytesPropiedad: number; bytesGlobal: number };

// null si el nuevo archivo cabe en todas las cuotas; si no, el motivo (422).
export function errorDeCuota(uso: UsoDocumentos, nuevoBytes: number): string | null {
  if (uso.documentosPropiedad + 1 > MAX_DOCUMENTOS_PROPIEDAD) {
    return `La propiedad alcanzó el máximo de ${MAX_DOCUMENTOS_PROPIEDAD} documentos`;
  }
  if (uso.bytesPropiedad + nuevoBytes > MAX_BYTES_PROPIEDAD) {
    return "La propiedad excedería el máximo de 200 MB de documentos";
  }
  if (uso.bytesGlobal + nuevoBytes > MAX_BYTES_GLOBAL) {
    return "Se alcanzó el límite de almacenamiento de documentos de la demostración (1 GB)";
  }
  return null;
}

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
