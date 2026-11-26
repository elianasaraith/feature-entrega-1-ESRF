import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Documento, PrismaClient } from "@prisma/client";
import {
  BYTES_FIRMA,
  COMPLETADAS_RETENCION_SEGUNDOS,
  LIMPIEZA_LOTE,
  MARGEN_LIMPIEZA_SEGUNDOS,
  VIDA_RESERVA_SEGUNDOS,
  claveDefinitiva,
  claveTemporal,
  coincideFirma,
  esClaveTemporalDe,
  tipoBase,
} from "@/server/domain/documento";
import { ConflictError, NotFoundError, ServiceUnavailableError, UnprocessableError } from "@/server/errors";
import type { RegistroInput, SubidaInput } from "@/server/schemas/documento";
import {
  type AlmacenDocumentos,
  AlmacenError,
  AlmacenPrecondicionError,
  esEtagVerificable,
  type UrlFirmada,
} from "@/server/storage/almacen";
import { createReservasPrisma, type RepositorioReservas } from "./documento-reservas";
import { asegurarPropiedad } from "./propiedad-lookup";

export type VinculoDocumento = { tipo: "CREDITO" | "CONTRATO" | "ABONO" | "MOVIMIENTO"; id: string };

export type DocumentoDto = {
  id: string;
  propiedadId: string;
  vinculo: VinculoDocumento | null;
  tipo: Documento["tipo"];
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: string;
  subidoEn: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SIN_DOCUMENTO = "Documento no encontrado";
const SIN_ALMACEN = "El almacenamiento de documentos no está configurado";
const SIN_SECRETO = "La subida de documentos no está configurada";
const AUTORIZACION_INVALIDA = "La autorización de subida no es válida o venció";
const FALLA_ALMACEN = "No se pudo comunicar con el almacenamiento de documentos";

function toDto(d: Documento): DocumentoDto {
  const vinculo: VinculoDocumento | null = d.creditoId
    ? { tipo: "CREDITO", id: d.creditoId }
    : d.contratoId
      ? { tipo: "CONTRATO", id: d.contratoId }
      : d.abonoArriendoId
        ? { tipo: "ABONO", id: d.abonoArriendoId }
        : d.movimientoFinancieroId
          ? { tipo: "MOVIMIENTO", id: d.movimientoFinancieroId }
          : null;
  return {
    id: d.id,
    propiedadId: d.propiedadId,
    vinculo,
    tipo: d.tipo,
    nombreArchivo: d.nombreArchivo,
    mimeType: d.mimeType,
    tamanoBytes: d.tamanoBytes.toString(),
    subidoEn: d.subidoEn.toISOString(),
  };
}

// Documentos de una propiedad (T11 + seguridad-mvp): solo metadata en PostgreSQL; el
// binario vive en el almacenamiento privado y viaja directo del navegador al bucket, a una
// clave TEMPORAL. El backend lo valida, fija su ETag y lo promueve a la clave definitiva
// (design.md D9). Sin almacén o sin secreto (`null`), las operaciones que lo necesitan
// responden 503; nunca se usa otro secreto como sustituto.
export type OpcionesDocumentos = {
  // `DOCUMENT_UPLOAD_SECRET`: secreto independiente con el que se firma la autorización de
  // subida (nunca sale del servidor; sin fallback a las credenciales del almacén ni a AUTH_SECRET).
  secretoToken: string | null;
  registrarError?: (mensaje: string, error: unknown) => void;
  ahora?: () => Date;
  // Reservas de subida (PostgreSQL por defecto; en memoria en las pruebas unitarias).
  reservas?: RepositorioReservas;
};

export function createDocumentoService(
  prisma: PrismaClient,
  almacen: AlmacenDocumentos | null,
  opciones: OpcionesDocumentos
) {
  const registrarError = opciones.registrarError ?? ((m, e) => console.error(m, e));
  const ahora = opciones.ahora ?? (() => new Date());
  const reservas = opciones.reservas ?? createReservasPrisma(prisma);

  function requerirSecreto(): string {
    if (!opciones.secretoToken) throw new ServiceUnavailableError(SIN_SECRETO);
    return opciones.secretoToken;
  }

  // Autoriza una reserva concreta (clave, tipo y tamaño): el cliente no puede registrar
  // una clave que el servidor no emitió ni cambiar lo autorizado.
  function firmar(reservaId: string, clave: string, mimeType: string, tamanoBytes: number, expira: number): string {
    return createHmac("sha256", requerirSecreto())
      .update(`documento-subida|${reservaId}|${clave}|${mimeType}|${tamanoBytes}|${expira}`)
      .digest("hex");
  }
  function emitirToken(reservaId: string, clave: string, mimeType: string, tamanoBytes: number): string {
    const expira = Math.floor(ahora().getTime() / 1000) + VIDA_RESERVA_SEGUNDOS;
    return `${reservaId}.${expira}.${firmar(reservaId, clave, mimeType, tamanoBytes, expira)}`;
  }
  // Devuelve el id de la reserva si el token es válido para esa clave, tipo y tamaño.
  function verificarToken(token: string, clave: string, mimeType: string, tamanoBytes: number): string | null {
    const [reservaId = "", expiraTexto = "", firma = ""] = token.split(".");
    const expira = Number(expiraTexto);
    if (!UUID.test(reservaId) || !Number.isInteger(expira) || expira < Math.floor(ahora().getTime() / 1000)) return null;
    const esperada = Buffer.from(firmar(reservaId, clave, mimeType, tamanoBytes, expira));
    const recibida = Buffer.from(firma);
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida) ? reservaId : null;
  }

  // Mejor esfuerzo: un fallo se registra y no interrumpe la operación.
  async function borrarSilencioso(a: AlmacenDocumentos, clave: string, motivo: string) {
    try {
      await a.borrar(clave);
    } catch (error) {
      registrarError(`${motivo}: ${clave}`, error);
    }
  }

  function requerirAlmacen(): AlmacenDocumentos {
    if (!almacen) throw new ServiceUnavailableError(SIN_ALMACEN);
    return almacen;
  }

  async function conAlmacen<T>(operacion: (a: AlmacenDocumentos) => Promise<T>): Promise<T> {
    try {
      return await operacion(requerirAlmacen());
    } catch (error) {
      if (error instanceof AlmacenPrecondicionError) {
        throw new UnprocessableError("El archivo cambió durante la validación; vuelva a subirlo");
      }
      if (error instanceof AlmacenError) throw new ServiceUnavailableError(FALLA_ALMACEN);
      throw error;
    }
  }

  // Limpieza oportunista y acotada (design.md D11), sin tarea programada: reservas
  // abandonadas (se reclaman a EXPIRADA antes de borrar nada) con su objeto temporal y, solo
  // si ningún documento lo referencia, el definitivo; y reservas completadas antiguas.
  async function limpiar(a: AlmacenDocumentos) {
    const t = ahora();
    try {
      const antes = new Date(t.getTime() - MARGEN_LIMPIEZA_SEGUNDOS * 1000);
      const vencidas = await reservas.reclamarVencidas(antes, t, LIMPIEZA_LOTE);
      const borradas: string[] = [];
      for (const r of vencidas) {
        try {
          await a.borrar(r.claveTemporal);
          if (!(await reservas.claveDefinitivaReferenciada(r.claveDefinitiva))) await a.borrar(r.claveDefinitiva);
          borradas.push(r.id);
        } catch (error) {
          registrarError(`No se pudo limpiar la reserva vencida ${r.id}`, error);
        }
      }
      await reservas.eliminar(borradas);
      const temporales = await reservas.eliminarCompletadasAnteriores(
        new Date(t.getTime() - COMPLETADAS_RETENCION_SEGUNDOS * 1000),
        LIMPIEZA_LOTE
      );
      for (const clave of temporales) await borrarSilencioso(a, clave, "No se pudo borrar un temporal antiguo");
    } catch (error) {
      registrarError("No se pudo ejecutar la limpieza de subidas", error);
    }
  }

  // El vínculo debe pertenecer a la propiedad (abono → pago → contrato → propiedad).
  async function columnasDeVinculo(propiedadId: string, vinculo: VinculoDocumento | null | undefined) {
    if (!vinculo) return {};
    const { tipo, id } = vinculo;
    const existe =
      tipo === "CREDITO"
        ? await prisma.creditoHipotecario.findFirst({ where: { id, propiedadId }, select: { id: true } })
        : tipo === "CONTRATO"
          ? await prisma.contratoArriendo.findFirst({ where: { id, propiedadId }, select: { id: true } })
          : tipo === "ABONO"
            ? await prisma.abonoArriendo.findFirst({
                where: { id, pagoEsperado: { contrato: { propiedadId } } },
                select: { id: true },
              })
            : await prisma.movimientoFinanciero.findFirst({ where: { id, propiedadId }, select: { id: true } });
    if (!existe) throw new UnprocessableError("El vínculo indicado no existe en esta propiedad");
    switch (tipo) {
      case "CREDITO":
        return { creditoId: id };
      case "CONTRATO":
        return { contratoId: id };
      case "ABONO":
        return { abonoArriendoId: id };
      default:
        return { movimientoFinancieroId: id };
    }
  }

  async function obtenerFila(propiedadId: string, documentoId: string): Promise<Documento> {
    await asegurarPropiedad(prisma, propiedadId);
    if (!UUID.test(documentoId)) throw new NotFoundError(SIN_DOCUMENTO);
    const fila = await prisma.documento.findFirst({ where: { id: documentoId, propiedadId } });
    if (!fila) throw new NotFoundError(SIN_DOCUMENTO);
    return fila;
  }

  // Paso 3: valida, promueve y registra. Devuelve también si el documento se creó ahora
  // (201) o ya existía por un registro anterior con el mismo token (200, idempotente).
  async function registrarConEstado(propiedadId: string, input: RegistroInput): Promise<{ documento: DocumentoDto; creado: boolean }> {
    await asegurarPropiedad(prisma, propiedadId);
    if (!esClaveTemporalDe(input.storageKey, propiedadId)) {
      throw new UnprocessableError("La clave del archivo no corresponde a esta propiedad");
    }
    const reservaId = verificarToken(input.tokenSubida, input.storageKey, input.mimeType, input.tamanoBytes);
    if (!reservaId) throw new UnprocessableError(AUTORIZACION_INVALIDA);
    const reserva = await reservas.obtener(reservaId);
    if (!reserva || reserva.propiedadId !== propiedadId || reserva.claveTemporal !== input.storageKey) {
      throw new UnprocessableError(AUTORIZACION_INVALIDA);
    }
    const existente = async () => {
      const doc = reserva.documentoId ? await reservas.documentoDe(reserva.documentoId) : null;
      return doc ? { documento: toDto(doc), creado: false } : null;
    };
    if (reserva.estado === "COMPLETADA") {
      const previo = await existente();
      if (previo) return previo;
      throw new ConflictError("La subida ya se completó y el documento fue eliminado");
    }
    const vinculo = await columnasDeVinculo(propiedadId, input.vinculo);
    const a = requerirAlmacen();

    // Reclamo atómico: un solo ganador; el token es de un solo uso.
    const reclamada = await reservas.reclamar(reserva.id, ahora());
    if (!reclamada) {
      const actual = await reservas.obtener(reserva.id);
      if (actual?.estado === "COMPLETADA") {
        const previo = await (async () => {
          const doc = actual.documentoId ? await reservas.documentoDe(actual.documentoId) : null;
          return doc ? { documento: toDto(doc), creado: false } : null;
        })();
        if (previo) return previo;
      }
      if (actual?.estado === "EN_PROCESO" && actual.expiraEn > ahora()) {
        throw new ConflictError("La confirmación de este archivo ya está en curso");
      }
      throw new UnprocessableError(AUTORIZACION_INVALIDA);
    }

    let promovido = false;
    let completada = false;
    try {
      // Comprobación efectiva del objeto almacenado, no de lo declarado por el cliente.
      const objeto = await conAlmacen((x) => x.inspeccionar(reserva.claveTemporal));
      if (objeto === null) throw new UnprocessableError("El archivo no se encontró en el almacenamiento");
      if (objeto.tamanoBytes !== reserva.tamanoBytes || tipoBase(objeto.contentType) !== reserva.mimeType) {
        await borrarSilencioso(a, reserva.claveTemporal, "No se pudo descartar el objeto rechazado");
        throw new UnprocessableError("El archivo subido no coincide con el tamaño o tipo autorizados");
      }
      // El ETag fijado identifica la versión validada. No se confía en que el almacén
      // respete If-Match: se compara el ETag de cada respuesta con el fijado.
      const etag = objeto.etag;
      if (!esEtagVerificable(etag)) {
        await borrarSilencioso(a, reserva.claveTemporal, "ETag no verificable; objeto descartado");
        throw new ServiceUnavailableError("El almacenamiento no devolvió un ETag verificable (MD5)");
      }
      const inicio = await conAlmacen((x) => x.leerInicio(reserva.claveTemporal, BYTES_FIRMA, etag));
      if (inicio === null) throw new UnprocessableError("El archivo no se encontró en el almacenamiento");
      if (inicio.etag !== etag) throw new UnprocessableError("El archivo cambió durante la validación; vuelva a subirlo");
      if (!coincideFirma(reserva.mimeType, inicio.bytes)) {
        await borrarSilencioso(a, reserva.claveTemporal, "No se pudo descartar el objeto rechazado");
        throw new UnprocessableError("El contenido del archivo no corresponde al formato declarado");
      }
      // Promoción: copia en el almacén (los bytes no pasan por la aplicación) a una clave
      // distinta que el navegador no puede escribir, y verificación del resultado.
      promovido = true;
      await conAlmacen((x) => x.copiarCondicional(reserva.claveTemporal, reserva.claveDefinitiva, etag));
      const definitivo = await conAlmacen((x) => x.inspeccionar(reserva.claveDefinitiva));
      if (definitivo === null || definitivo.etag !== etag || definitivo.tamanoBytes !== reserva.tamanoBytes) {
        throw new UnprocessableError("El archivo cambió durante la validación; vuelva a subirlo");
      }
      try {
        const fila = await reservas.completar(reserva, {
          propiedadId,
          tipo: reserva.tipo,
          nombreArchivo: reserva.nombreArchivo,
          mimeType: reserva.mimeType,
          tamanoBytes: reserva.tamanoBytes,
          storageKey: reserva.claveDefinitiva,
          vinculo,
        });
        completada = true;
        await borrarSilencioso(a, reserva.claveTemporal, "No se pudo borrar el objeto temporal");
        return { documento: toDto(fila), creado: true };
      } catch (error) {
        // El commit pudo confirmarse aunque la respuesta se perdiera: si la reserva ya está
        // COMPLETADA el documento existe y su objeto definitivo NO debe revertirse.
        const actual = await reservas.obtener(reserva.id).catch(() => null);
        if (actual?.estado === "COMPLETADA") {
          const doc = actual.documentoId ? await reservas.documentoDe(actual.documentoId).catch(() => null) : null;
          if (doc) {
            completada = true;
            return { documento: toDto(doc), creado: true };
          }
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictError("Ese archivo ya está registrado");
        }
        throw error;
      }
    } finally {
      if (!completada) {
        // Fallo parcial: nunca queda fila sin objeto ni objeto definitivo sin fila.
        if (promovido) await borrarSilencioso(a, reserva.claveDefinitiva, "No se pudo revertir el objeto promovido");
        await reservas.liberar(reserva.id).catch((error) => registrarError("No se pudo liberar la reserva", error));
      }
    }
  }

  return {
    // Paso 1: valida, aplica cuotas, crea la reserva y entrega la clave TEMPORAL y la URL
    // firmada de subida. No inserta ningún documento.
    async solicitarSubida(
      propiedadId: string,
      input: SubidaInput
    ): Promise<{ storageKey: string; tokenSubida: string; subida: UrlFirmada }> {
      await asegurarPropiedad(prisma, propiedadId);
      await columnasDeVinculo(propiedadId, input.vinculo);
      const a = requerirAlmacen();
      requerirSecreto();
      await limpiar(a);
      const temporal = claveTemporal(propiedadId, randomUUID());
      const reserva = await reservas.reservarConCuota(
        {
          propiedadId,
          tipo: input.tipo,
          nombreArchivo: input.nombreArchivo,
          mimeType: input.mimeType,
          tamanoBytes: input.tamanoBytes,
          claveTemporal: temporal,
          claveDefinitiva: claveDefinitiva(propiedadId, randomUUID()),
          expiraEn: new Date(ahora().getTime() + VIDA_RESERVA_SEGUNDOS * 1000),
        },
        ahora()
      );
      try {
        const subida = await conAlmacen((x) =>
          x.urlSubida(reserva.claveTemporal, { mimeType: input.mimeType, tamanoBytes: input.tamanoBytes })
        );
        return { storageKey: reserva.claveTemporal, tokenSubida: emitirToken(reserva.id, reserva.claveTemporal, input.mimeType, input.tamanoBytes), subida };
      } catch (error) {
        await reservas.eliminar([reserva.id]).catch(() => undefined);
        throw error;
      }
    },

    registrarConEstado,
    async registrar(propiedadId: string, input: RegistroInput): Promise<DocumentoDto> {
      return (await registrarConEstado(propiedadId, input)).documento;
    },

    // Una sola consulta por propiedad, de cualquier vínculo; no usa el almacenamiento.
    async listar(propiedadId: string): Promise<DocumentoDto[]> {
      await asegurarPropiedad(prisma, propiedadId);
      const filas = await prisma.documento.findMany({
        where: { propiedadId },
        orderBy: [{ subidoEn: "desc" }, { id: "asc" }],
      });
      return filas.map(toDto);
    },

    async urlLectura(propiedadId: string, documentoId: string): Promise<UrlFirmada> {
      const fila = await obtenerFila(propiedadId, documentoId);
      return conAlmacen((a) => a.urlLectura(fila.storageKey, fila.nombreArchivo));
    },

    // Primero la fila (sin metadata que apunte a un archivo inexistente); luego el
    // objeto. Si su borrado falla queda un objeto huérfano (architecture.md §13.3).
    async eliminar(propiedadId: string, documentoId: string): Promise<{ eliminado: true }> {
      const fila = await obtenerFila(propiedadId, documentoId);
      const a = requerirAlmacen();
      await prisma.documento.delete({ where: { id: fila.id } });
      try {
        await a.borrar(fila.storageKey);
      } catch (error) {
        registrarError(`Objeto huérfano en el almacenamiento: ${fila.storageKey}`, error);
      }
      return { eliminado: true };
    },
  };
}
