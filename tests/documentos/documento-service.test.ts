import { test } from "node:test";
import assert from "node:assert/strict";
import type { Documento, PrismaClient } from "@prisma/client";
import {
  LIMPIEZA_LOTE,
  MAX_BYTES_GLOBAL,
  MAX_BYTES_PROPIEDAD,
  MAX_DOCUMENTOS_PROPIEDAD,
  esClaveTemporalDe,
} from "../../server/domain/documento";
import { ConflictError, NotFoundError, ServiceUnavailableError, UnprocessableError } from "../../server/errors";
import { registroSchema, subidaSchema } from "../../server/schemas/documento";
import { createDocumentoService } from "../../server/services/documento-service";
import { type AlmacenDocumentos, AlmacenError, AlmacenPrecondicionError } from "../../server/storage/almacen";
import { createReservasMemoria } from "./reservas-memoria";

// Servicio de documentos con Prisma, reservas y almacén simulados: sin red ni base de datos.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PROP = U(1);
const OTRA = U(2);
const CONTRATO = U(3);
const CONTRATO_AJENO = U(4);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7];
const HTML = [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0];

type Objeto = { tamanoBytes: number; contentType: string; inicio: number[]; etag: string };
type Opciones = {
  fallaAlmacen?: boolean;
  fallaBorrado?: boolean;
  fallaCompletar?: () => boolean;
  // El commit de `completar` se confirma pero se pierde la respuesta (error tras el commit).
  respuestaPerdida?: boolean;
  sinSecreto?: boolean;
  // El almacén ignora If-Match y x-amz-copy-source-if-match (peor caso).
  ignoraCondiciones?: boolean;
};

function entorno(opts: Opciones = {}) {
  const objetos = new Map<string, Objeto>();
  const borrados: string[] = [];
  const copias: string[] = [];
  const urlsEscritura: string[] = [];
  const ganchos: { tras_inspeccionar?: () => void; tras_leer?: () => void; antes_copiar?: () => void } = {};
  let reloj = new Date("2026-11-23T12:00:00Z");
  const almacen: AlmacenDocumentos = {
    async urlSubida(clave, a) {
      urlsEscritura.push(clave);
      return { url: `https://bucket.test/${clave}?firma`, metodo: "PUT", headers: { "content-type": a.mimeType }, expiraEnSegundos: 300 };
    },
    async urlLectura(clave, nombre) {
      return { url: `https://bucket.test/${clave}?firma&n=${nombre}`, metodo: "GET", headers: {}, expiraEnSegundos: 300 };
    },
    async inspeccionar(clave) {
      if (opts.fallaAlmacen) throw new AlmacenError("caído");
      const o = objetos.get(clave);
      const r = o ? { tamanoBytes: o.tamanoBytes, contentType: o.contentType, etag: o.etag } : null;
      ganchos.tras_inspeccionar?.();
      return r;
    },
    async leerInicio(clave, n, etag) {
      const o = objetos.get(clave);
      if (!o) return null;
      if (!opts.ignoraCondiciones && etag && o.etag !== etag) throw new AlmacenPrecondicionError();
      const r = { bytes: Uint8Array.from(o.inicio.slice(0, n)), etag: o.etag };
      ganchos.tras_leer?.();
      return r;
    },
    async copiarCondicional(origen, destino, etag) {
      ganchos.antes_copiar?.();
      const o = objetos.get(origen);
      if (!o) throw new AlmacenError("origen inexistente");
      if (!opts.ignoraCondiciones && o.etag !== etag) throw new AlmacenPrecondicionError();
      copias.push(`${origen}->${destino}`);
      objetos.set(destino, { ...o });
    },
    async borrar(clave) {
      if (opts.fallaBorrado) throw new AlmacenError("caído");
      borrados.push(clave);
      objetos.delete(clave);
    },
  };
  const filas: Documento[] = [];
  const prisma = {
    propiedad: { findUnique: async ({ where }: { where: { id: string } }) => ([PROP, OTRA].includes(where.id) ? { id: where.id } : null) },
    creditoHipotecario: { findFirst: async () => null },
    movimientoFinanciero: { findFirst: async () => null },
    abonoArriendo: { findFirst: async () => null },
    contratoArriendo: {
      findFirst: async ({ where }: { where: { id: string; propiedadId: string } }) =>
        where.id === CONTRATO && where.propiedadId === PROP ? { id: CONTRATO } : null,
    },
    documento: {
      findMany: async ({ where }: { where: { propiedadId: string } }) => filas.filter((f) => f.propiedadId === where.propiedadId),
      findFirst: async ({ where }: { where: { id: string; propiedadId: string } }) => filas.find((f) => f.id === where.id && f.propiedadId === where.propiedadId) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        filas.splice(filas.findIndex((f) => f.id === where.id), 1);
      },
    },
  };
  const { repo, filas: reservas } = createReservasMemoria(filas, { fallaCompletar: opts.fallaCompletar });
  if (opts.respuestaPerdida) {
    const completarReal = repo.completar.bind(repo);
    let perdida = true;
    repo.completar = async (reserva, datos) => {
      const doc = await completarReal(reserva, datos); // el commit ocurre
      if (perdida) {
        perdida = false;
        throw new Error("conexión perdida tras el commit");
      }
      return doc;
    };
  }
  const errores: string[] = [];
  const opcionesServicio = {
    secretoToken: opts.sinSecreto ? null : "secreto-de-pruebas",
    registrarError: (m: string) => errores.push(m),
    ahora: () => reloj,
    reservas: repo,
  };
  const servicio = createDocumentoService(prisma as unknown as PrismaClient, almacen, opcionesServicio);
  const sinAlmacen = createDocumentoService(prisma as unknown as PrismaClient, null, { ...opcionesServicio, secretoToken: null });
  const adelantar = (segundos: number) => (reloj = new Date(reloj.getTime() + segundos * 1000));
  // ETag con forma de MD5 (32 hex), como los que devuelve un PUT simple.
  const nuevoEtag = (() => { let n = 0; return () => String(++n).padStart(32, "a"); })();
  return { servicio, sinAlmacen, filas, reservas, borrados, copias, urlsEscritura, errores, objetos, adelantar, ganchos, nuevoEtag, reloj: () => reloj };
}
type Entorno = ReturnType<typeof entorno>;

const base = { tipo: "CONTRATO_ARRIENDO", nombreArchivo: "contrato.pdf", mimeType: "application/pdf", tamanoBytes: 2048 };

// Recorre el flujo real: el servidor emite clave temporal y token; "el navegador" sube; se registra.
async function subir(e: Entorno, propiedad = PROP, extra: object = {}, objeto: Partial<Objeto> = {}) {
  const pedido = { ...base, ...extra };
  const r = await e.servicio.solicitarSubida(propiedad, subidaSchema.parse(pedido));
  e.objetos.set(r.storageKey, { tamanoBytes: pedido.tamanoBytes, contentType: "application/pdf", inicio: PDF, etag: e.nuevoEtag(), ...objeto });
  return registroSchema.parse({ ...pedido, storageKey: r.storageKey, tokenSubida: r.tokenSubida });
}
const reservaDe = (e: Entorno, clave: string) => [...e.reservas.values()].find((r) => r.claveTemporal === clave)!;

test("solicitarSubida entrega clave TEMPORAL de la propiedad, URL firmada y token, y crea una reserva sin documento", async () => {
  const e = entorno();
  const r = await e.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.ok(esClaveTemporalDe(r.storageKey, PROP));
  assert.equal(r.subida.metodo, "PUT");
  assert.equal(r.subida.expiraEnSegundos, 300);
  assert.ok(r.tokenSubida.length > 20);
  assert.equal(e.filas.length, 0);
  assert.equal(e.reservas.size, 1);
  assert.equal(reservaDe(e, r.storageKey).estado, "PENDIENTE");
});

test("seguridad: solo se emite escritura para claves tmp/ y nunca para la definitiva", async () => {
  const e = entorno();
  const reg = await subir(e);
  assert.deepEqual(e.urlsEscritura, [reg.storageKey]);
  assert.ok(e.urlsEscritura.every((k) => k.startsWith("tmp/propiedades/")));
  const doc = await e.servicio.registrar(PROP, reg);
  assert.ok(doc.id);
  assert.ok(e.urlsEscritura.every((k) => !k.startsWith("propiedades/")));
});

test("el esquema rechaza formato y tamaño inválidos, y exige el token al registrar", () => {
  assert.ok(!subidaSchema.safeParse({ ...base, mimeType: "text/html" }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tamanoBytes: 0 }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tamanoBytes: 21 * 1024 * 1024 }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tipo: "RARO" }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, nombreArchivo: "a".repeat(256) }).success);
  assert.ok(!registroSchema.safeParse({ ...base, storageKey: "k" }).success);
});

test("propiedad inexistente o id inválido: 404", async () => {
  const e = entorno();
  await assert.rejects(e.servicio.solicitarSubida(U(99), subidaSchema.parse(base)), NotFoundError);
  await assert.rejects(e.servicio.listar("no-uuid"), NotFoundError);
});

test("sin almacenamiento o sin secreto de subida: 503 y sin reservas; el listado sigue funcionando", async () => {
  const e = entorno();
  await assert.rejects(e.sinAlmacen.solicitarSubida(PROP, subidaSchema.parse(base)), ServiceUnavailableError);
  assert.deepEqual(await e.sinAlmacen.listar(PROP), []);
  const s = entorno({ sinSecreto: true });
  await assert.rejects(s.servicio.solicitarSubida(PROP, subidaSchema.parse(base)), ServiceUnavailableError);
  assert.equal(s.reservas.size, 0);
});

test("registro correcto: el objeto se promueve a una clave definitiva distinta y el temporal se elimina", async () => {
  const e = entorno();
  const reg = await subir(e, PROP, { vinculo: { tipo: "CONTRATO", id: CONTRATO } });
  const d = await e.servicio.registrar(PROP, reg);
  assert.equal(d.tamanoBytes, "2048");
  assert.deepEqual(d.vinculo, { tipo: "CONTRATO", id: CONTRATO });
  assert.equal(e.filas.length, 1);
  assert.ok(!JSON.stringify(d).includes("propiedades/")); // la clave del objeto no sale en el DTO
  const definitiva = e.filas[0].storageKey;
  assert.ok(definitiva.startsWith(`propiedades/${PROP}/`) && !definitiva.startsWith("tmp/"));
  assert.notEqual(definitiva, reg.storageKey);
  assert.ok(e.objetos.has(definitiva));
  assert.ok(!e.objetos.has(reg.storageKey));
  assert.equal(reservaDe(e, reg.storageKey).estado, "COMPLETADA");
});

test("seguridad: clave no emitida, con forma inválida o de otra propiedad, o token falso/ajeno: 422 y sin fila", async () => {
  const e = entorno();
  const valido = await subir(e);
  const inventada = `tmp/propiedades/${PROP}/${U(77)}`;
  e.objetos.set(inventada, { tamanoBytes: 2048, contentType: "application/pdf", inicio: PDF, etag: "x" });
  for (const clave of [
    inventada,
    `propiedades/${PROP}/${U(5)}`, // clave definitiva: no es una clave de subida
    `tmp/propiedades/${PROP}/../${PROP}/${U(5)}`,
    `tmp/propiedades/${PROP}/${U(5)}/extra`,
    `tmp/propiedades/${OTRA}/${U(5)}`,
  ]) {
    await assert.rejects(e.servicio.registrar(PROP, { ...valido, storageKey: clave }), UnprocessableError, clave);
  }
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, tokenSubida: "9999999999.abc" }), UnprocessableError);
  // El token autoriza un tipo y un tamaño concretos: no se pueden cambiar al registrar.
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, mimeType: "image/png" }), UnprocessableError);
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, tamanoBytes: 1 }), UnprocessableError);
  // La reserva de otra propiedad no sirve en esta.
  const ajena = await subir(e, OTRA);
  await assert.rejects(e.servicio.registrar(PROP, ajena), UnprocessableError);
  assert.equal(e.filas.length, 0);
});

test("seguridad: la forma de la clave temporal se valida estrictamente", () => {
  assert.ok(esClaveTemporalDe(`tmp/propiedades/${PROP}/${U(5)}`, PROP));
  assert.ok(!esClaveTemporalDe(`tmp/propiedades/${PROP}/${U(5)}`, OTRA));
  assert.ok(!esClaveTemporalDe(`propiedades/${PROP}/${U(5)}`, PROP));
  assert.ok(!esClaveTemporalDe(`tmp/propiedades/${PROP}/no-uuid`, PROP));
  assert.ok(!esClaveTemporalDe(`tmp/propiedades/${PROP}/${U(5)}\n`, PROP));
});

test("seguridad: el token vence", async () => {
  const e = entorno();
  const reg = await subir(e);
  e.adelantar(601);
  await assert.rejects(e.servicio.registrar(PROP, reg), UnprocessableError);
  assert.equal(e.filas.length, 0);
});

test("seguridad: objeto inexistente, de otro tamaño o de otro Content-Type: 422; el inválido se descarta", async () => {
  const e = entorno();
  const sinObjeto = await subir(e);
  e.objetos.clear();
  await assert.rejects(e.servicio.registrar(PROP, sinObjeto), UnprocessableError);

  const otroTamano = await subir(e, PROP, {}, { tamanoBytes: 999 });
  await assert.rejects(e.servicio.registrar(PROP, otroTamano), UnprocessableError);
  assert.ok(e.borrados.includes(otroTamano.storageKey));

  const otroTipo = await subir(e, PROP, {}, { contentType: "text/html" });
  await assert.rejects(e.servicio.registrar(PROP, otroTipo), UnprocessableError);
  assert.ok(e.borrados.includes(otroTipo.storageKey));
  assert.equal(e.filas.length, 0);
  assert.equal(e.copias.length, 0);
});

test("seguridad: el contenido real debe corresponder al formato declarado (firma de bytes)", async () => {
  const e = entorno();
  const falso = await subir(e, PROP, {}, { inicio: HTML }); // HTML disfrazado de PDF
  await assert.rejects(e.servicio.registrar(PROP, falso), (err) => err instanceof UnprocessableError && /formato/.test(err.message));
  assert.ok(e.borrados.includes(falso.storageKey));
  assert.equal(e.filas.length, 0);
  assert.equal(e.copias.length, 0);
});

test("vínculo de otra propiedad: 422 y sin fila", async () => {
  const e = entorno();
  await assert.rejects(
    e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, vinculo: { tipo: "CONTRATO", id: CONTRATO_AJENO } })),
    UnprocessableError
  );
  await assert.rejects(
    e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, vinculo: { tipo: "CREDITO", id: U(50) } })),
    UnprocessableError
  );
  assert.equal(e.filas.length, 0);
  assert.equal(e.reservas.size, 0);
});

test("registro repetido con el mismo token es idempotente (200, sin segunda fila ni segundo objeto)", async () => {
  const e = entorno();
  const reg = await subir(e);
  const a = await e.servicio.registrarConEstado(PROP, reg);
  const b = await e.servicio.registrarConEstado(PROP, reg);
  assert.equal(a.creado, true);
  assert.equal(b.creado, false);
  assert.equal(a.documento.id, b.documento.id);
  assert.equal(e.filas.length, 1);
  assert.equal(e.copias.length, 1);
});

test("fallo del almacenamiento: 503, sin fila y la reserva queda reintentable", async () => {
  const caido = entorno({ fallaAlmacen: true });
  const reg2 = await subir(caido);
  await assert.rejects(caido.servicio.registrar(PROP, reg2), ServiceUnavailableError);
  assert.equal(caido.filas.length, 0);
  assert.equal(reservaDe(caido, reg2.storageKey).estado, "PENDIENTE");
});

test("seguridad: confirmaciones simultáneas con el mismo token crean un solo documento", async () => {
  const e = entorno();
  const reg = await subir(e);
  const resultados = await Promise.allSettled([e.servicio.registrarConEstado(PROP, reg), e.servicio.registrarConEstado(PROP, reg), e.servicio.registrarConEstado(PROP, reg)]);
  assert.equal(e.filas.length, 1);
  assert.equal(e.copias.length, 1);
  const creados = resultados.filter((r) => r.status === "fulfilled" && r.value.creado);
  assert.equal(creados.length, 1);
  for (const r of resultados) {
    if (r.status === "rejected") assert.ok(r.reason instanceof ConflictError, "el perdedor recibe 409");
  }
});

test("seguridad: si el temporal se sobrescribe tras validar, la copia condicional falla y nada se promueve", async () => {
  const e = entorno();
  const reg = await subir(e);
  e.ganchos.antes_copiar = () => e.objetos.set(reg.storageKey, { tamanoBytes: 2048, contentType: "application/pdf", inicio: HTML, etag: "malicioso" });
  await assert.rejects(e.servicio.registrar(PROP, reg), UnprocessableError);
  assert.equal(e.filas.length, 0);
  assert.equal(e.copias.length, 0);
  assert.ok(![...e.objetos.keys()].some((k) => k.startsWith("propiedades/")));
  assert.equal(reservaDe(e, reg.storageKey).estado, "PENDIENTE");
});

test("seguridad: aunque el almacén ignore las condiciones, un ETag distinto al validado impide la promoción", async () => {
  // (a) el objeto cambia entre la inspección y la lectura de bytes
  const a = entorno({ ignoraCondiciones: true });
  const regA = await subir(a);
  a.ganchos.tras_inspeccionar = () => a.objetos.set(regA.storageKey, { tamanoBytes: 2048, contentType: "application/pdf", inicio: PDF, etag: "otro" });
  await assert.rejects(a.servicio.registrar(PROP, regA), UnprocessableError);
  assert.equal(a.filas.length, 0);
  assert.equal(a.copias.length, 0);

  // (b) el objeto cambia después de leer los bytes y antes de copiar: la copia promueve el
  // contenido nuevo, pero el ETag del objeto definitivo difiere del validado → se borra.
  const b = entorno({ ignoraCondiciones: true });
  const regB = await subir(b);
  b.ganchos.tras_leer = () => b.objetos.set(regB.storageKey, { tamanoBytes: 2048, contentType: "application/pdf", inicio: HTML, etag: "malicioso" });
  await assert.rejects(b.servicio.registrar(PROP, regB), UnprocessableError);
  assert.equal(b.filas.length, 0);
  assert.ok(![...b.objetos.keys()].some((k) => k.startsWith("propiedades/")), "el objeto definitivo no validado se elimina");
  assert.ok(b.borrados.some((k) => k.startsWith("propiedades/")));
});

test("fallo parcial: si falla la inserción tras promover, se elimina el definitivo y la reserva queda reintentable", async () => {
  let fallar = true;
  const e = entorno({ fallaCompletar: () => fallar });
  const reg = await subir(e);
  await assert.rejects(e.servicio.registrar(PROP, reg), /falla de base de datos/);
  assert.equal(e.filas.length, 0);
  assert.ok(![...e.objetos.keys()].some((k) => k.startsWith("propiedades/")));
  assert.equal(reservaDe(e, reg.storageKey).estado, "PENDIENTE");
  fallar = false;
  const d = await e.servicio.registrar(PROP, reg); // reintento con el mismo token
  assert.ok(d.id);
  assert.equal(e.filas.length, 1);
});

test("seguridad: un ETag débil o de multipart no permite verificar los bytes: se descarta y no se promueve", async () => {
  for (const etag of ['W/"abc"', "0123456789abcdef0123456789abcdef-3", "etag-corto"]) {
    const e = entorno();
    const reg = await subir(e, PROP, {}, { etag });
    await assert.rejects(e.servicio.registrar(PROP, reg), ServiceUnavailableError, etag);
    assert.equal(e.filas.length, 0);
    assert.equal(e.copias.length, 0);
    assert.ok(e.borrados.includes(reg.storageKey));
  }
});

test("fallo parcial: si el commit se confirmó pero la respuesta se perdió, el documento y el objeto definitivo se conservan", async () => {
  const e = entorno({ respuestaPerdida: true });
  const reg = await subir(e);
  const r = await e.servicio.registrarConEstado(PROP, reg);
  assert.equal(r.documento.id, e.filas[0].id);
  assert.equal(e.filas.length, 1);
  assert.ok(e.objetos.has(e.filas[0].storageKey), "el objeto definitivo no se revirtió");
  assert.equal(reservaDe(e, reg.storageKey).estado, "COMPLETADA");
});

test("fallo parcial: una confirmación abandonada en proceso puede reclamarse tras el plazo", async () => {
  const e = entorno();
  const reg = await subir(e);
  const r = reservaDe(e, reg.storageKey);
  r.estado = "EN_PROCESO";
  r.reclamadaEn = e.reloj();
  await assert.rejects(e.servicio.registrar(PROP, reg), ConflictError);
  e.adelantar(61);
  assert.ok((await e.servicio.registrar(PROP, reg)).id);
});

test("cuotas: máximo de documentos por propiedad, contando reservas pendientes", async () => {
  const e = entorno();
  for (let i = 0; i < MAX_DOCUMENTOS_PROPIEDAD; i++) await e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 10 }));
  await assert.rejects(e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 10 })), (err) => err instanceof UnprocessableError && /50/.test(err.message));
  // Otra propiedad no se ve afectada.
  await e.servicio.solicitarSubida(OTRA, subidaSchema.parse({ ...base, tamanoBytes: 10 }));
});

test("cuotas: bytes por propiedad y global, incluidos documentos ya registrados", async () => {
  const e = entorno();
  const MB = 1024 * 1024;
  const llenar = (propiedadId: string, bytes: number, n: number) =>
    e.filas.push({ id: U(5000 + n), propiedadId, tamanoBytes: BigInt(bytes), storageKey: `propiedades/${propiedadId}/${n}` } as Documento);
  // 190 MB ya registrados en la propiedad: caben 10 MB, no 11.
  llenar(PROP, 190 * MB, 1);
  await e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 10 * MB }));
  await assert.rejects(e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 1 * MB })), (err) => err instanceof UnprocessableError && /200 MB/.test(err.message));
  assert.ok(MAX_BYTES_PROPIEDAD === 200 * MB);
  // Global: otras propiedades ocupan casi 1 GB.
  const g = entorno();
  g.filas.push({ id: U(6000), propiedadId: OTRA, tamanoBytes: BigInt(MAX_BYTES_GLOBAL - 5 * MB), storageKey: "propiedades/x/1" } as Documento);
  await g.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 5 * MB }));
  await assert.rejects(g.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 1 })), (err) => err instanceof UnprocessableError && /1 GB/.test(err.message));
});

test("cuotas: solicitudes simultáneas en el límite no lo superan y las reservas vencidas liberan cupo", async () => {
  const e = entorno();
  const MB = 1024 * 1024;
  e.filas.push({ id: U(5001), propiedadId: PROP, tamanoBytes: BigInt(195 * MB), storageKey: "propiedades/p/1" } as Documento);
  const resultados = await Promise.allSettled([
    e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 4 * MB })),
    e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 4 * MB })),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((r) => r.status === "rejected").length, 1);
  // La reserva vence: ya no cuenta.
  e.adelantar(601);
  await e.servicio.solicitarSubida(PROP, subidaSchema.parse({ ...base, tamanoBytes: 4 * MB }));
});

test("limpieza: reservas abandonadas vencidas se eliminan con su objeto temporal, sin tocar definitivos referenciados", async () => {
  const e = entorno();
  const vieja = await subir(e);
  const definitivaVieja = reservaDe(e, vieja.storageKey).claveDefinitiva;
  e.objetos.set(definitivaVieja, { tamanoBytes: 1, contentType: "application/pdf", inicio: PDF, etag: "d" });
  e.filas.push({ id: U(7000), propiedadId: PROP, tamanoBytes: BigInt(1), storageKey: definitivaVieja } as Documento); // referenciada por un documento
  const huerfana = await subir(e);
  const definitivaHuerfana = reservaDe(e, huerfana.storageKey).claveDefinitiva;
  e.objetos.set(definitivaHuerfana, { tamanoBytes: 1, contentType: "application/pdf", inicio: PDF, etag: "h" });
  e.adelantar(601 + 300 + 1); // vencidas y pasado el margen de limpieza
  await e.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.ok(!e.objetos.has(vieja.storageKey) && !e.objetos.has(huerfana.storageKey));
  assert.ok(e.objetos.has(definitivaVieja), "el definitivo referenciado por un documento no se borra");
  assert.ok(!e.objetos.has(definitivaHuerfana));
  assert.equal(e.reservas.size, 1); // solo la nueva
});

test("limpieza: dentro del margen o con confirmación en curso no se toca nada; el lote está acotado", async () => {
  const e = entorno();
  const reg = await subir(e);
  const r = reservaDe(e, reg.storageKey);
  r.estado = "EN_PROCESO";
  r.reclamadaEn = e.reloj();
  e.adelantar(601 + 10); // vencida, pero dentro del margen y con confirmación reciente
  await e.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.ok(e.objetos.has(reg.storageKey));
  assert.equal(r.estado, "EN_PROCESO");
  // Lote acotado
  const m = entorno();
  for (let i = 0; i < LIMPIEZA_LOTE + 5; i++) await subir(m, i % 2 ? PROP : OTRA);
  m.adelantar(601 + 300 + 1);
  await m.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.equal(m.reservas.size, 5 + 1);
});

test("limpieza: las reservas completadas con más de un día se eliminan, junto con un temporal huérfano de una URL PUT reutilizada, sin afectar a los documentos", async () => {
  const e = entorno();
  const reg = await subir(e);
  await e.servicio.registrar(PROP, reg);
  // La URL de subida seguía vigente tras registrar: el navegador volvió a escribir el temporal.
  e.objetos.set(reg.storageKey, { tamanoBytes: 2048, contentType: "application/pdf", inicio: PDF, etag: "z".padStart(32, "z") });
  const definitiva = e.filas[0].storageKey;
  e.adelantar(24 * 3600 + 700);
  await e.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.equal(e.reservas.size, 1);
  assert.equal(e.filas.length, 1);
  assert.ok(!e.objetos.has(reg.storageKey), "el temporal huérfano se borra");
  assert.ok(e.objetos.has(definitiva), "el definitivo registrado se conserva");
});

test("compatibilidad: un documento registrado antes del cambio (clave definitiva antigua) se lista, descarga y elimina", async () => {
  const e = entorno();
  const antigua = `propiedades/${PROP}/${U(8000)}`;
  e.filas.push({ id: U(8001), propiedadId: PROP, tipo: "OTRO", nombreArchivo: "viejo.pdf", mimeType: "application/pdf", tamanoBytes: BigInt(10), storageKey: antigua, subidoEn: new Date(), creditoId: null, contratoId: null, abonoArriendoId: null, movimientoFinancieroId: null } as Documento);
  e.objetos.set(antigua, { tamanoBytes: 10, contentType: "application/pdf", inicio: PDF, etag: "v" });
  assert.equal((await e.servicio.listar(PROP)).length, 1);
  const u = await e.servicio.urlLectura(PROP, U(8001));
  assert.ok(u.url.includes(antigua));
  assert.deepEqual(await e.servicio.eliminar(PROP, U(8001)), { eliminado: true });
  assert.deepEqual(e.borrados, [antigua]);
});

test("listar devuelve solo los documentos de la propiedad", async () => {
  const e = entorno();
  await e.servicio.registrar(PROP, await subir(e, PROP));
  await e.servicio.registrar(OTRA, await subir(e, OTRA));
  assert.equal((await e.servicio.listar(PROP)).length, 1);
  assert.equal((await e.servicio.listar(OTRA)).length, 1);
});

test("URL de lectura: documento propio sí (vida corta), de otra propiedad 404", async () => {
  const e = entorno();
  const d = await e.servicio.registrar(PROP, await subir(e));
  const u = await e.servicio.urlLectura(PROP, d.id);
  assert.equal(u.metodo, "GET");
  assert.equal(u.expiraEnSegundos, 300);
  await assert.rejects(e.servicio.urlLectura(OTRA, d.id), NotFoundError);
  await assert.rejects(e.servicio.urlLectura(PROP, "no-uuid"), NotFoundError);
});

test("eliminar borra fila y objeto; si falla el borrado del objeto la fila igual desaparece y se registra el huérfano sin credenciales", async () => {
  const ok = entorno();
  const d = await ok.servicio.registrar(PROP, await subir(ok));
  const definitiva = ok.filas[0].storageKey;
  ok.borrados.length = 0;
  assert.deepEqual(await ok.servicio.eliminar(PROP, d.id), { eliminado: true });
  assert.deepEqual(ok.borrados, [definitiva]);
  assert.equal(ok.filas.length, 0);

  const falla = entorno({ fallaBorrado: true });
  const d2 = await falla.servicio.registrar(PROP, await subir(falla));
  assert.deepEqual(await falla.servicio.eliminar(PROP, d2.id), { eliminado: true });
  assert.equal(falla.filas.length, 0);
  assert.ok(falla.errores.length >= 1);
  assert.ok(falla.errores.every((m) => !m.includes("secreto-de-pruebas")));
});
