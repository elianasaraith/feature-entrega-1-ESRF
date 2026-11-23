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
  // Tamaño y Content-Type reales del objeto almacenado, o null si no existe.
  inspeccionar(clave: string): Promise<{ tamanoBytes: number; contentType: string | null } | null>;
  // Primeros `n` bytes del objeto (para comprobar su firma de formato), o null si no existe.
  leerInicio(clave: string, n: number): Promise<Uint8Array | null>;
  borrar(clave: string): Promise<void>;
}

// Fallo de comunicación o de configuración del almacenamiento.
export class AlmacenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlmacenError";
  }
}

export const VIDA_URL_SEGUNDOS = 300;
