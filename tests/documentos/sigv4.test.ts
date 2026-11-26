import { test } from "node:test";
import assert from "node:assert/strict";
import { coincideFirma, errorDeArchivo, TAMANO_MAXIMO_BYTES } from "../../server/domain/documento";
import { prefirmarUrl } from "../../server/storage/s3-sigv4";
import { almacenDesdeEntorno, createS3Almacen } from "../../server/storage/s3-almacen";
import { AlmacenPrecondicionError, esEtagVerificable } from "../../server/storage/almacen";

test("SigV4: coincide con el ejemplo oficial de AWS (URL prefirmada GET)", () => {
  const url = prefirmarUrl({
    metodo: "GET",
    host: "examplebucket.s3.amazonaws.com",
    ruta: "/test.txt",
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    expiraEnSegundos: 86400,
    ahora: new Date("2013-05-24T00:00:00Z"),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test("el almacén S3 firma PUT con content-type y content-length, sin exponer el secreto", async () => {
  const almacen = createS3Almacen(
    { endpoint: "https://cuenta.r2.cloudflarestorage.com", region: "auto", bucket: "docs", accessKeyId: "AK", secretAccessKey: "SECRETO-PRIVADO" },
    { ahora: () => new Date("2026-11-23T12:00:00Z") }
  );
  const u = await almacen.urlSubida("tmp/propiedades/p/k", { mimeType: "application/pdf", tamanoBytes: 1234 });
  assert.equal(u.metodo, "PUT");
  assert.ok(u.url.startsWith("https://cuenta.r2.cloudflarestorage.com/docs/tmp/propiedades/p/k?"));
  assert.match(u.url, /X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost/);
  assert.match(u.url, /X-Amz-Expires=300/);
  assert.ok(!JSON.stringify(u).includes("SECRETO-PRIVADO"));
  assert.deepEqual(u.headers, { "content-type": "application/pdf" });
});

test("el almacén S3 inspecciona, lee el inicio y borra con respuestas HTTP simuladas", async () => {
  const llamadas: string[] = [];
  let estado = 200;
  const fetchFn = (async (url: string, init: { method: string; headers?: Record<string, string> }) => {
    llamadas.push(`${init.method} ${new URL(url).pathname}${init.headers?.range ? ` ${init.headers.range}` : ""}`);
    if (init.method === "GET") return new Response(estado === 200 ? new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7, 8, 9]) : null, { status: estado });
    return new Response(null, { status: estado, headers: { "content-length": "42", "content-type": "application/pdf", etag: '"abc123"' } });
  }) as unknown as typeof fetch;
  const almacen = createS3Almacen(
    { endpoint: "https://x.example", region: "auto", bucket: "b", accessKeyId: "AK", secretAccessKey: "S" },
    { fetchFn }
  );
  assert.deepEqual(await almacen.inspeccionar("k"), { tamanoBytes: 42, contentType: "application/pdf", etag: "abc123" });
  const inicio = await almacen.leerInicio("k", 12);
  assert.deepEqual([...(inicio?.bytes ?? [])], [0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7]);
  estado = 404;
  assert.equal(await almacen.inspeccionar("k"), null);
  assert.equal(await almacen.leerInicio("k", 12), null);
  await almacen.borrar("k"); // 404 al borrar no es error
  estado = 500;
  await assert.rejects(almacen.inspeccionar("k"), /almacenamiento/);
  await assert.rejects(almacen.leerInicio("k", 12), /almacenamiento/);
  await assert.rejects(almacen.borrar("k"), /almacenamiento/);
  assert.equal(llamadas[0], "HEAD /b/k");
  assert.equal(llamadas[1], "GET /b/k bytes=0-11");
});

test("seguridad: nunca se emite URL de escritura para una clave definitiva", async () => {
  const almacen = createS3Almacen({ endpoint: "https://x.example", region: "auto", bucket: "b", accessKeyId: "AK", secretAccessKey: "S" });
  await assert.rejects(almacen.urlSubida("propiedades/p/k", { mimeType: "application/pdf", tamanoBytes: 10 }), /temporales/);
});

test("copia condicional: firma x-amz-copy-source y if-match, y un 412 es AlmacenPrecondicionError", async () => {
  const peticiones: { url: string; init: { method: string; headers: Record<string, string> } }[] = [];
  let estado = 200;
  let cuerpo = "<CopyObjectResult/>";
  const fetchFn = (async (url: string, init: { method: string; headers: Record<string, string> }) => {
    peticiones.push({ url, init });
    return new Response(cuerpo, { status: estado });
  }) as unknown as typeof fetch;
  const almacen = createS3Almacen({ endpoint: "https://x.example", region: "auto", bucket: "b", accessKeyId: "AK", secretAccessKey: "S" }, { fetchFn });
  await almacen.copiarCondicional("tmp/propiedades/p/t", "propiedades/p/d", "abc123");
  const { url, init } = peticiones[0];
  assert.equal(init.method, "PUT");
  assert.equal(init.headers["x-amz-copy-source"], "/b/tmp/propiedades/p/t");
  assert.equal(init.headers["x-amz-copy-source-if-match"], '"abc123"');
  assert.match(url, /X-Amz-SignedHeaders=host%3Bx-amz-copy-source%3Bx-amz-copy-source-if-match/);
  assert.ok(new URL(url).pathname.endsWith("/b/propiedades/p/d"));
  estado = 412;
  await assert.rejects(almacen.copiarCondicional("a", "b", "x"), AlmacenPrecondicionError);
  estado = 200;
  cuerpo = "<Error><Code>InternalError</Code></Error>"; // S3 puede devolver 200 con error en el cuerpo
  await assert.rejects(almacen.copiarCondicional("a", "b", "x"), /rechaz/);
});

test("lectura de inicio: envía If-Match, devuelve el ETag de la respuesta y un 412 es precondición fallida", async () => {
  let estado = 200;
  let cabecerasEnviadas: Record<string, string> = {};
  const fetchFn = (async (_url: string, init: { headers: Record<string, string> }) => {
    cabecerasEnviadas = init.headers;
    return new Response(estado === 200 ? new Uint8Array([1, 2, 3]) : null, { status: estado, headers: { etag: 'W/"zzz"' } });
  }) as unknown as typeof fetch;
  const almacen = createS3Almacen({ endpoint: "https://x.example", region: "auto", bucket: "b", accessKeyId: "AK", secretAccessKey: "S" }, { fetchFn });
  const r = await almacen.leerInicio("k", 3, "zzz");
  assert.equal(cabecerasEnviadas["if-match"], '"zzz"');
  assert.equal(r?.etag, 'W/"zzz"', "un ETag débil conserva su prefijo (no es verificable)");
  assert.equal(esEtagVerificable(r?.etag ?? null), false);
  assert.equal(esEtagVerificable("0123456789abcdef0123456789abcdef"), true);
  assert.equal(esEtagVerificable("0123456789abcdef0123456789abcdef-4"), false);
  estado = 412;
  await assert.rejects(almacen.leerInicio("k", 3, "zzz"), AlmacenPrecondicionError);
});

test("firmas de formato: el contenido real debe coincidir con el tipo declarado", () => {
  const bytes = (...v: number[]) => Uint8Array.from([...v, ...new Array(12 - v.length).fill(0)]);
  assert.ok(coincideFirma("application/pdf", bytes(0x25, 0x50, 0x44, 0x46, 0x2d)));
  assert.ok(coincideFirma("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)));
  assert.ok(coincideFirma("image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)));
  assert.ok(coincideFirma("image/webp", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)));
  assert.ok(!coincideFirma("application/pdf", bytes(0xff, 0xd8, 0xff)));
  assert.ok(!coincideFirma("image/png", bytes(0x25, 0x50, 0x44, 0x46, 0x2d)));
  assert.ok(!coincideFirma("image/webp", bytes(0x52, 0x49, 0x46, 0x46)));
  assert.ok(!coincideFirma("text/html", bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c)));
});

test("sin variables de entorno no hay almacén configurado", () => {
  assert.equal(almacenDesdeEntorno({}), null);
  assert.equal(almacenDesdeEntorno({ S3_ENDPOINT: "https://x", S3_BUCKET: "b" }), null);
  assert.ok(
    almacenDesdeEntorno({ S3_ENDPOINT: "https://x", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "s" })
  );
});

test("reglas de formato y tamaño", () => {
  assert.equal(errorDeArchivo("application/pdf", 1000), null);
  assert.equal(errorDeArchivo("image/webp", TAMANO_MAXIMO_BYTES), null);
  assert.ok(errorDeArchivo("text/html", 1000));
  assert.ok(errorDeArchivo("application/pdf", 0));
  assert.ok(errorDeArchivo("application/pdf", -1));
  assert.ok(errorDeArchivo("application/pdf", TAMANO_MAXIMO_BYTES + 1));
  assert.ok(errorDeArchivo("application/pdf", 1.5));
});
