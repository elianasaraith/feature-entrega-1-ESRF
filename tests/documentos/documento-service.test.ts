import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError, ServiceUnavailableError, UnprocessableError } from "../../server/errors";
import { registroSchema, subidaSchema } from "../../server/schemas/documento";
import { createDocumentoService } from "../../server/services/documento-service";
import { type AlmacenDocumentos, AlmacenError } from "../../server/storage/almacen";

// Servicio de documentos con Prisma y almacén simulados: sin red ni base de datos.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PROP = U(1);
const OTRA = U(2);
const CONTRATO = U(3);
const CONTRATO_AJENO = U(4);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7];

type Fila = {
  id: string; propiedadId: string; creditoId: string | null; contratoId: string | null; abonoArriendoId: string | null;
  movimientoFinancieroId: string | null; tipo: string; nombreArchivo: string; mimeType: string; tamanoBytes: bigint;
  storageKey: string; subidoEn: Date;
};
type Objeto = { tamanoBytes: number; contentType: string; inicio: number[] };

function entorno(opts: { fallaAlmacen?: boolean; fallaBorrado?: boolean } = {}) {
  const objetos = new Map<string, Objeto>();
  const borrados: string[] = [];
  let reloj = new Date("2026-11-23T12:00:00Z");
  const almacen: AlmacenDocumentos = {
    async urlSubida(clave, a) {
      return { url: `https://bucket.test/${clave}?firma`, metodo: "PUT", headers: { "content-type": a.mimeType }, expiraEnSegundos: 300 };
    },
    async urlLectura(clave, nombre) {
      return { url: `https://bucket.test/${clave}?firma&n=${nombre}`, metodo: "GET", headers: {}, expiraEnSegundos: 300 };
    },
    async inspeccionar(clave) {
      if (opts.fallaAlmacen) throw new AlmacenError("caído");
      const o = objetos.get(clave);
      return o ? { tamanoBytes: o.tamanoBytes, contentType: o.contentType } : null;
    },
    async leerInicio(clave, n) {
      const o = objetos.get(clave);
      return o ? Uint8Array.from(o.inicio.slice(0, n)) : null;
    },
    async borrar(clave) {
      if (opts.fallaBorrado) throw new AlmacenError("caído");
      borrados.push(clave);
      objetos.delete(clave);
    },
  };
  const filas: Fila[] = [];
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
      create: async ({ data }: { data: Partial<Fila> & { storageKey: string } }) => {
        if (filas.some((f) => f.storageKey === data.storageKey)) {
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        }
        const fila = { id: U(1000 + filas.length), creditoId: null, contratoId: null, abonoArriendoId: null, movimientoFinancieroId: null, subidoEn: new Date("2026-11-23T10:00:00Z"), ...data } as Fila;
        filas.push(fila);
        return fila;
      },
      findMany: async ({ where }: { where: { propiedadId: string } }) => filas.filter((f) => f.propiedadId === where.propiedadId),
      findFirst: async ({ where }: { where: { id: string; propiedadId: string } }) => filas.find((f) => f.id === where.id && f.propiedadId === where.propiedadId) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        filas.splice(filas.findIndex((f) => f.id === where.id), 1);
      },
    },
  };
  const errores: string[] = [];
  const opcionesServicio = { secretoToken: "secreto-de-pruebas", registrarError: (m: string) => errores.push(m), ahora: () => reloj };
  const servicio = createDocumentoService(prisma as unknown as PrismaClient, almacen, opcionesServicio);
  const sinAlmacen = createDocumentoService(prisma as unknown as PrismaClient, null, { secretoToken: null });
  const adelantar = (segundos: number) => (reloj = new Date(reloj.getTime() + segundos * 1000));
  return { servicio, sinAlmacen, filas, borrados, errores, objetos, adelantar };
}
type Entorno = ReturnType<typeof entorno>;

const base = { tipo: "CONTRATO_ARRIENDO", nombreArchivo: "contrato.pdf", mimeType: "application/pdf", tamanoBytes: 2048 };

// Recorre el flujo real: el servidor emite clave y token; "el navegador" sube; se registra.
async function subir(e: Entorno, propiedad = PROP, extra: object = {}, objeto: Partial<Objeto> = {}) {
  const pedido = { ...base, ...extra };
  const r = await e.servicio.solicitarSubida(propiedad, subidaSchema.parse(pedido));
  e.objetos.set(r.storageKey, { tamanoBytes: 2048, contentType: "application/pdf", inicio: PDF, ...objeto });
  return registroSchema.parse({ ...pedido, storageKey: r.storageKey, tokenSubida: r.tokenSubida });
}

test("solicitarSubida entrega clave de la propiedad, URL firmada y token, sin escribir en la base", async () => {
  const e = entorno();
  const r = await e.servicio.solicitarSubida(PROP, subidaSchema.parse(base));
  assert.ok(r.storageKey.startsWith(`propiedades/${PROP}/`));
  assert.equal(r.subida.metodo, "PUT");
  assert.equal(r.subida.expiraEnSegundos, 300);
  assert.ok(r.tokenSubida.length > 20);
  assert.equal(e.filas.length, 0);
});

test("el esquema rechaza formato y tamaño inválidos, y exige el token al registrar", () => {
  assert.ok(!subidaSchema.safeParse({ ...base, mimeType: "text/html" }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tamanoBytes: 0 }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tamanoBytes: 21 * 1024 * 1024 }).success);
  assert.ok(!subidaSchema.safeParse({ ...base, tipo: "RARO" }).success);
  assert.ok(!registroSchema.safeParse({ ...base, storageKey: "k" }).success);
});

test("propiedad inexistente o id inválido: 404", async () => {
  const e = entorno();
  await assert.rejects(e.servicio.solicitarSubida(U(99), subidaSchema.parse(base)), NotFoundError);
  await assert.rejects(e.servicio.listar("no-uuid"), NotFoundError);
});

test("sin almacenamiento configurado: 503 y sin filas; el listado sigue funcionando", async () => {
  const e = entorno();
  await assert.rejects(e.sinAlmacen.solicitarSubida(PROP, subidaSchema.parse(base)), ServiceUnavailableError);
  assert.deepEqual(await e.sinAlmacen.listar(PROP), []);
});

test("registro correcto con vínculo a contrato de la propiedad", async () => {
  const e = entorno();
  const d = await e.servicio.registrar(PROP, await subir(e, PROP, { vinculo: { tipo: "CONTRATO", id: CONTRATO } }));
  assert.equal(d.tamanoBytes, "2048");
  assert.deepEqual(d.vinculo, { tipo: "CONTRATO", id: CONTRATO });
  assert.equal(e.filas.length, 1);
  assert.ok(!JSON.stringify(d).includes("propiedades/")); // la clave del objeto no sale en el DTO
});

test("seguridad: clave no emitida por el servidor o token falso/ajeno: 422 y sin fila", async () => {
  const e = entorno();
  const valido = await subir(e);
  const inventada = `propiedades/${PROP}/inventada`;
  e.objetos.set(inventada, { tamanoBytes: 2048, contentType: "application/pdf", inicio: PDF });
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, storageKey: inventada }), UnprocessableError);
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, tokenSubida: "9999999999.abc" }), UnprocessableError);
  // El token autoriza un tipo y un tamaño concretos: no se pueden cambiar al registrar.
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, mimeType: "image/png" }), UnprocessableError);
  await assert.rejects(e.servicio.registrar(PROP, { ...valido, tamanoBytes: 1 }), UnprocessableError);
  // La clave de otra propiedad no sirve en esta.
  const ajena = await subir(e, OTRA);
  await assert.rejects(e.servicio.registrar(PROP, ajena), UnprocessableError);
  assert.equal(e.filas.length, 0);
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
});

test("seguridad: el contenido real debe corresponder al formato declarado (firma de bytes)", async () => {
  const e = entorno();
  const falso = await subir(e, PROP, {}, { inicio: [0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0] }); // HTML disfrazado de PDF
  await assert.rejects(e.servicio.registrar(PROP, falso), (err) => err instanceof UnprocessableError && /formato/.test(err.message));
  assert.ok(e.borrados.includes(falso.storageKey));
  assert.equal(e.filas.length, 0);
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
});

test("registro repetido: 409; fallo del almacenamiento: 503 sin fila", async () => {
  const e = entorno();
  const reg = await subir(e);
  await e.servicio.registrar(PROP, reg);
  await assert.rejects(e.servicio.registrar(PROP, reg), ConflictError);
  const caido = entorno({ fallaAlmacen: true });
  const reg2 = await subir(caido);
  await assert.rejects(caido.servicio.registrar(PROP, reg2), ServiceUnavailableError);
  assert.equal(caido.filas.length, 0);
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
  const reg = await subir(ok);
  const d = await ok.servicio.registrar(PROP, reg);
  assert.deepEqual(await ok.servicio.eliminar(PROP, d.id), { eliminado: true });
  assert.deepEqual(ok.borrados, [reg.storageKey]);
  assert.equal(ok.filas.length, 0);

  const falla = entorno({ fallaBorrado: true });
  const d2 = await falla.servicio.registrar(PROP, await subir(falla));
  assert.deepEqual(await falla.servicio.eliminar(PROP, d2.id), { eliminado: true });
  assert.equal(falla.filas.length, 0);
  assert.equal(falla.errores.length, 1);
  assert.ok(!falla.errores[0].includes("secreto-de-pruebas"));
});
