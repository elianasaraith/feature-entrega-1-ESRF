import { createHash, createHmac } from "node:crypto";

// URL prefirmada de AWS Signature V4 por query string (S3 y compatibles, p. ej.
// Cloudflare R2). Solo node:crypto: sin dependencias. Verificada con el ejemplo
// oficial de AWS en tests/documentos/sigv4.test.ts.
export type OpcionesPrefirma = {
  metodo: "GET" | "PUT" | "HEAD" | "DELETE";
  esquema?: "https" | "http";
  host: string;
  // Ruta absoluta sin codificar (p. ej. "/bucket/clave/con espacios").
  ruta: string;
  region: string;
  servicio?: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiraEnSegundos: number;
  ahora: Date;
  // Cabeceras adicionales firmadas (nombre en minúsculas).
  cabeceras?: Record<string, string>;
  // Parámetros de consulta adicionales (p. ej. response-content-disposition).
  consulta?: Record<string, string>;
};

const hex = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (clave: string | Buffer, data: string) => createHmac("sha256", clave).update(data, "utf8").digest();
const codificar = (v: string) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function prefirmarUrl(o: OpcionesPrefirma): string {
  const servicio = o.servicio ?? "s3";
  const amzFecha = o.ahora.toISOString().replace(/[-:]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dia = amzFecha.slice(0, 8);
  const alcance = `${dia}/${o.region}/${servicio}/aws4_request`;

  const cabeceras: Record<string, string> = { host: o.host, ...o.cabeceras };
  const nombres = Object.keys(cabeceras).sort();
  const firmadas = nombres.join(";");

  const parametros: Record<string, string> = {
    ...o.consulta,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${o.accessKeyId}/${alcance}`,
    "X-Amz-Date": amzFecha,
    "X-Amz-Expires": String(o.expiraEnSegundos),
    "X-Amz-SignedHeaders": firmadas,
  };
  const consultaCanonica = Object.keys(parametros)
    .sort()
    .map((k) => `${codificar(k)}=${codificar(parametros[k])}`)
    .join("&");

  const rutaCanonica = o.ruta.split("/").map(codificar).join("/");
  const solicitud = [
    o.metodo,
    rutaCanonica,
    consultaCanonica,
    nombres.map((n) => `${n}:${cabeceras[n].trim()}\n`).join(""),
    firmadas,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const aFirmar = ["AWS4-HMAC-SHA256", amzFecha, alcance, hex(solicitud)].join("\n");
  const clave = hmac(hmac(hmac(hmac(`AWS4${o.secretAccessKey}`, dia), o.region), servicio), "aws4_request");
  const firma = createHmac("sha256", clave).update(aFirmar, "utf8").digest("hex");

  return `${o.esquema ?? "https"}://${o.host}${rutaCanonica}?${consultaCanonica}&X-Amz-Signature=${firma}`;
}
