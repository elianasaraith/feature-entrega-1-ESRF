import { type AlmacenDocumentos, AlmacenError, AlmacenPrecondicionError, normalizarEtag, VIDA_URL_SEGUNDOS } from "./almacen";
import { prefirmarUrl } from "./s3-sigv4";

// Almacén S3-compatible (Cloudflare R2, AWS S3, Backblaze B2) con direccionamiento
// por ruta. Las credenciales provienen solo del entorno del servidor.
export type ConfigS3 = {
  endpoint: string; // p. ej. https://<cuenta>.r2.cloudflarestorage.com
  region: string; // "auto" en R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function createS3Almacen(
  cfg: ConfigS3,
  deps: { ahora?: () => Date; fetchFn?: typeof fetch } = {}
): AlmacenDocumentos {
  const ahora = deps.ahora ?? (() => new Date());
  const fetchFn = deps.fetchFn ?? fetch;
  const base = new URL(cfg.endpoint);
  const esquema = base.protocol === "http:" ? "http" : "https";

  const firmar = (
    metodo: "GET" | "PUT" | "HEAD" | "DELETE",
    clave: string,
    extra: { cabeceras?: Record<string, string>; consulta?: Record<string, string> } = {}
  ) =>
    prefirmarUrl({
      metodo,
      esquema,
      host: base.host,
      ruta: `/${cfg.bucket}/${clave}`,
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      expiraEnSegundos: VIDA_URL_SEGUNDOS,
      ahora: ahora(),
      ...extra,
    });

  async function llamar(metodo: "HEAD" | "DELETE", clave: string): Promise<Response> {
    try {
      return await fetchFn(firmar(metodo, clave), { method: metodo, signal: AbortSignal.timeout(5000) });
    } catch {
      throw new AlmacenError("No se pudo comunicar con el almacenamiento");
    }
  }

  return {
    async urlSubida(clave, { mimeType, tamanoBytes }) {
      // Nunca se emite permiso de escritura para una clave definitiva (seguridad-mvp).
      if (!clave.startsWith("tmp/")) throw new AlmacenError("Solo se permite subir a claves temporales");
      const cabeceras = { "content-length": String(tamanoBytes), "content-type": mimeType };
      return { url: firmar("PUT", clave, { cabeceras }), metodo: "PUT", headers: { "content-type": mimeType }, expiraEnSegundos: VIDA_URL_SEGUNDOS };
    },
    async urlLectura(clave, nombreDescarga) {
      const disposicion = `attachment; filename*=UTF-8''${encodeURIComponent(nombreDescarga)}`;
      return {
        url: firmar("GET", clave, { consulta: { "response-content-disposition": disposicion } }),
        metodo: "GET",
        headers: {},
        expiraEnSegundos: VIDA_URL_SEGUNDOS,
      };
    },
    async inspeccionar(clave) {
      const r = await llamar("HEAD", clave);
      if (r.status === 404) return null;
      if (!r.ok) throw new AlmacenError(`El almacenamiento respondió ${r.status}`);
      const largo = Number(r.headers.get("content-length"));
      if (!Number.isFinite(largo)) throw new AlmacenError("Respuesta del almacenamiento sin tamaño");
      return { tamanoBytes: largo, contentType: r.headers.get("content-type"), etag: normalizarEtag(r.headers.get("etag")) };
    },
    // GET con Range (cabecera no firmada); se lee solo el inicio y se cancela el resto.
    async leerInicio(clave, n, etag) {
      let r: Response;
      try {
        r = await fetchFn(firmar("GET", clave), {
          method: "GET",
          headers: { range: `bytes=0-${n - 1}`, ...(etag ? { "if-match": `"${etag}"` } : {}) },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        throw new AlmacenError("No se pudo comunicar con el almacenamiento");
      }
      if (r.status === 404) return null;
      if (r.status === 412) throw new AlmacenPrecondicionError();
      if (!r.ok || !r.body) throw new AlmacenError(`El almacenamiento respondió ${r.status}`);
      const etagRespuesta = normalizarEtag(r.headers.get("etag"));
      const lector = r.body.getReader();
      const partes: Uint8Array[] = [];
      let total = 0;
      try {
        while (total < n) {
          const { done, value } = await lector.read();
          if (done) break;
          partes.push(value);
          total += value.length;
        }
      } finally {
        await lector.cancel().catch(() => undefined);
      }
      const salida = new Uint8Array(Math.min(total, n));
      let pos = 0;
      for (const parte of partes) {
        const trozo = parte.subarray(0, Math.min(parte.length, salida.length - pos));
        salida.set(trozo, pos);
        pos += trozo.length;
        if (pos >= salida.length) break;
      }
      return { bytes: salida, etag: etagRespuesta };
    },
    // CopyObject por URL prefirmada: `x-amz-copy-source` y `x-amz-copy-source-if-match`
    // van firmadas. Un 200 puede traer un <Error> en el cuerpo (comportamiento de S3).
    async copiarCondicional(origen, destino, etag) {
      const cabeceras = {
        "x-amz-copy-source": `/${cfg.bucket}/${origen.split("/").map(encodeURIComponent).join("/")}`,
        "x-amz-copy-source-if-match": `"${etag}"`,
      };
      let r: Response;
      try {
        r = await fetchFn(firmar("PUT", destino, { cabeceras }), {
          method: "PUT",
          headers: cabeceras,
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new AlmacenError("No se pudo comunicar con el almacenamiento");
      }
      if (r.status === 412) throw new AlmacenPrecondicionError();
      if (!r.ok) throw new AlmacenError(`El almacenamiento respondió ${r.status}`);
      const cuerpo = await r.text().catch(() => "");
      if (/<Error>/i.test(cuerpo)) throw new AlmacenError("El almacenamiento rechazó la copia");
    },
    async borrar(clave) {
      const r = await llamar("DELETE", clave);
      if (!r.ok && r.status !== 404) throw new AlmacenError(`El almacenamiento respondió ${r.status}`);
    },
  };
}

// null si falta alguna variable: las operaciones que lo requieren responden 503.
export function almacenDesdeEntorno(env: Record<string, string | undefined> = process.env): AlmacenDocumentos | null {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return createS3Almacen({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  });
}
