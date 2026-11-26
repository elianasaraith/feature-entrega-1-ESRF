// Puerto del almacenamiento de documentos (docs/architecture.md §13.1). El resto
// de la aplicación depende solo de esta interfaz, no del proveedor S3 concreto.
export type UrlFirmada = {
  url: string;
  metodo: "PUT" | "GET";
  // Cabeceras que el cliente debe enviar tal cual (forman parte de la firma).
  headers: Record<string, string>;
  expiraEnSegundos: number;
};

export interface AlmacenDocumentos {
  urlSubida(clave: string, archivo: { mimeType: string; tamanoBytes: number }): Promise<UrlFirmada>;
  urlLectura(clave: string, nombreDescarga: string): Promise<UrlFirmada>;
  // Tamaño, Content-Type y ETag reales del objeto almacenado, o null si no existe.
  inspeccionar(clave: string): Promise<{ tamanoBytes: number; contentType: string | null; etag: string | null } | null>;
  // Primeros `n` bytes del objeto (para comprobar su firma de formato) y el ETag de la
  // MISMA respuesta, o null si no existe. `etag` se envía como `If-Match`, pero la garantía
  // no depende de que el almacén lo respete: el llamador compara el ETag devuelto.
  // Lanza `AlmacenPrecondicionError` si el objeto cambió (412).
  leerInicio(clave: string, n: number, etag?: string | null): Promise<{ bytes: Uint8Array; etag: string | null } | null>;
  // Copia del lado del almacén `origen` → `destino` condicionada al ETag de `origen`.
  // Lanza `AlmacenPrecondicionError` si el origen ya no tiene ese ETag.
  copiarCondicional(origen: string, destino: string, etag: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}

// Fallo de comunicación o de configuración del almacenamiento.
export class AlmacenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlmacenError";
  }
}

// El objeto cambió entre la validación y la operación (precondición ETag fallida).
export class AlmacenPrecondicionError extends AlmacenError {
  constructor(message = "El objeto cambió durante la validación") {
    super(message);
    this.name = "AlmacenPrecondicionError";
  }
}

// ETag sin comillas, para comparar valores de distintas respuestas. Un ETag débil (`W/`)
// conserva su prefijo, de modo que `esEtagVerificable` lo rechaza.
export function normalizarEtag(etag: string | null | undefined): string | null {
  if (!etag) return null;
  const t = etag.trim();
  if (t.startsWith("W/")) return t; // débil: se conserva tal cual y no es verificable
  return t.replace(/^"|"$/g, "") || null;
}

// Solo un ETag que sea el MD5 del contenido (32 hex; sin prefijo débil ni sufijo `-N` de
// multipart) identifica los bytes: es lo que hace verificable la promoción del objeto.
export const esEtagVerificable = (etag: string | null): etag is string => etag !== null && /^[0-9a-f]{32}$/i.test(etag);

export const VIDA_URL_SEGUNDOS = 300;
