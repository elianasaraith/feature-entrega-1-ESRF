import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Documento, PrismaClient } from "@prisma/client";
import { BYTES_FIRMA, coincideFirma, prefijoClave, tipoBase } from "@/server/domain/documento";
import { ConflictError, NotFoundError, ServiceUnavailableError, UnprocessableError } from "@/server/errors";
import type { RegistroInput, SubidaInput } from "@/server/schemas/documento";
import { type AlmacenDocumentos, AlmacenError, type UrlFirmada } from "@/server/storage/almacen";
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
const VIDA_TOKEN_SEGUNDOS = 600; // el registro debe seguir a la subida (la URL dura 5 min)
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

// Documentos de una propiedad (T11): solo metadata en PostgreSQL; el binario vive en
// el almacenamiento privado y viaja directo del navegador al bucket. Sin almacén
// configurado (`null`), las operaciones que lo necesitan responden 503.
export type OpcionesDocumentos = {
  // Secreto del servidor con el que se firma la autorización de subida (nunca sale de él).
  secretoToken: string | null;
  registrarError?: (mensaje: string, error: unknown) => void;
  ahora?: () => Date;
};

export function createDocumentoService(
  prisma: PrismaClient,
  almacen: AlmacenDocumentos | null,
  opciones: OpcionesDocumentos
) {
  const registrarError = opciones.registrarError ?? ((m, e) => console.error(m, e));
  const ahora = opciones.ahora ?? (() => new Date());

  // Autoriza una clave concreta con un tipo y tamaño concretos: el cliente no puede
  // registrar una clave que el servidor no emitió ni cambiar lo autorizado.
  function firmar(storageKey: string, mimeType: string, tamanoBytes: number, expira: number): string {
    if (!opciones.secretoToken) throw new ServiceUnavailableError(SIN_ALMACEN);
    return createHmac("sha256", opciones.secretoToken)
      .update(`documento-subida|${storageKey}|${mimeType}|${tamanoBytes}|${expira}`)
      .digest("hex");
  }
  function emitirToken(storageKey: string, mimeType: string, tamanoBytes: number): string {
    const expira = Math.floor(ahora().getTime() / 1000) + VIDA_TOKEN_SEGUNDOS;
    return `${expira}.${firmar(storageKey, mimeType, tamanoBytes, expira)}`;
  }
  function verificarToken(token: string, storageKey: string, mimeType: string, tamanoBytes: number): boolean {
    const [expiraTexto, firma = ""] = token.split(".");
    const expira = Number(expiraTexto);
    if (!Number.isInteger(expira) || expira < Math.floor(ahora().getTime() / 1000)) return false;
    const esperada = Buffer.from(firmar(storageKey, mimeType, tamanoBytes, expira));
    const recibida = Buffer.from(firma);
    return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
  }

  // Un objeto que no cumple lo autorizado se descarta del almacenamiento (mejor esfuerzo).
  async function descartarObjeto(a: AlmacenDocumentos, clave: string) {
    try {
      await a.borrar(clave);
    } catch (error) {
      registrarError(`No se pudo descartar el objeto rechazado: ${clave}`, error);
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
      if (error instanceof AlmacenError) throw new ServiceUnavailableError(FALLA_ALMACEN);
      throw error;
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

  return {
    // Paso 1: valida y entrega la clave y la URL firmada de subida. No escribe en la base.
    async solicitarSubida(
      propiedadId: string,
      input: SubidaInput
    ): Promise<{ storageKey: string; tokenSubida: string; subida: UrlFirmada }> {
      await asegurarPropiedad(prisma, propiedadId);
      await columnasDeVinculo(propiedadId, input.vinculo);
      const storageKey = `${prefijoClave(propiedadId)}${randomUUID()}`;
      const subida = await conAlmacen((a) =>
        a.urlSubida(storageKey, { mimeType: input.mimeType, tamanoBytes: input.tamanoBytes })
      );
      const tokenSubida = emitirToken(storageKey, input.mimeType, input.tamanoBytes);
      return { storageKey, tokenSubida, subida };
    },

    // Paso 3: registra la metadata solo si el objeto existe con el tamaño declarado.
    async registrar(propiedadId: string, input: RegistroInput): Promise<DocumentoDto> {
      await asegurarPropiedad(prisma, propiedadId);
      if (!input.storageKey.startsWith(prefijoClave(propiedadId))) {
        throw new UnprocessableError("La clave del archivo no corresponde a esta propiedad");
      }
      if (!verificarToken(input.tokenSubida, input.storageKey, input.mimeType, input.tamanoBytes)) {
        throw new UnprocessableError("La autorización de subida no es válida o venció");
      }
      const vinculo = await columnasDeVinculo(propiedadId, input.vinculo);
      // Comprobación efectiva del objeto almacenado, no de lo declarado por el cliente:
      // existencia, tamaño, Content-Type y firma de formato de los primeros bytes.
      const a = requerirAlmacen();
      const objeto = await conAlmacen((x) => x.inspeccionar(input.storageKey));
      if (objeto === null) throw new UnprocessableError("El archivo no se encontró en el almacenamiento");
      if (objeto.tamanoBytes !== input.tamanoBytes || tipoBase(objeto.contentType) !== input.mimeType) {
        await descartarObjeto(a, input.storageKey);
        throw new UnprocessableError("El archivo subido no coincide con el tamaño o tipo autorizados");
      }
      const inicio = await conAlmacen((x) => x.leerInicio(input.storageKey, BYTES_FIRMA));
      if (inicio === null || !coincideFirma(input.mimeType, inicio)) {
        await descartarObjeto(a, input.storageKey);
        throw new UnprocessableError("El contenido del archivo no corresponde al formato declarado");
      }
      try {
        const fila = await prisma.documento.create({
          data: {
            propiedadId,
            tipo: input.tipo,
            nombreArchivo: input.nombreArchivo,
            mimeType: input.mimeType,
            tamanoBytes: BigInt(input.tamanoBytes),
            storageKey: input.storageKey,
            ...vinculo,
          },
        });
        return toDto(fila);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictError("Ese archivo ya está registrado");
        }
        throw error;
      }
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
