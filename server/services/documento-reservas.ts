import type { EstadoSubida, PrismaClient, TipoDocumento } from "@prisma/client";
import {
  RECLAMO_ABANDONADO_SEGUNDOS,
  errorDeCuota,
  type UsoDocumentos,
} from "@/server/domain/documento";
import { UnprocessableError } from "@/server/errors";
import type { Documento } from "@prisma/client";

// Reserva de subida de un solo uso (seguridad-mvp, design.md D9-D11). El servicio de
// documentos depende de este puerto; la implementación PostgreSQL usa operaciones
// atómicas (transacción con lock advisory para las cuotas, UPDATE condicional para
// reclamar) y las pruebas unitarias usan una implementación en memoria.
export type Reserva = {
  id: string;
  propiedadId: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  claveTemporal: string;
  claveDefinitiva: string;
  estado: EstadoSubida;
  expiraEn: Date;
  reclamadaEn: Date | null;
  documentoId: string | null;
};

export type NuevaReserva = Omit<Reserva, "id" | "estado" | "reclamadaEn" | "documentoId">;

export type DatosDocumento = {
  propiedadId: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  storageKey: string;
  vinculo: Partial<Pick<Documento, "creditoId" | "contratoId" | "abonoArriendoId" | "movimientoFinancieroId">>;
};

export interface RepositorioReservas {
  // Una sola unidad atómica y serializada: comprueba las cuotas (documentos + reservas
  // vigentes) y crea la reserva PENDIENTE. Lanza UnprocessableError si no cabe.
  reservarConCuota(nueva: NuevaReserva, ahora: Date): Promise<Reserva>;
  obtener(id: string): Promise<Reserva | null>;
  // PENDIENTE (o EN_PROCESO abandonada) y vigente → EN_PROCESO. null si otro la tiene,
  // venció o ya terminó: exactamente un ganador entre solicitudes concurrentes.
  reclamar(id: string, ahora: Date): Promise<Reserva | null>;
  // EN_PROCESO → PENDIENTE (no toca otros estados).
  liberar(id: string): Promise<void>;
  // Inserta el documento y marca la reserva COMPLETADA en una misma transacción.
  completar(reserva: Reserva, datos: DatosDocumento): Promise<Documento>;
  documentoDe(documentoId: string): Promise<Documento | null>;
  // Limpieza (acotada): reclama (→ EXPIRADA) y devuelve reservas abandonadas con expiración
  // anterior a `antes`; las ya EXPIRADA se devuelven de nuevo para reintentar su borrado.
  reclamarVencidas(antes: Date, ahora: Date, limite: number): Promise<Reserva[]>;
  claveDefinitivaReferenciada(clave: string): Promise<boolean>;
  eliminar(ids: string[]): Promise<void>;
  // Elimina la fila de las reservas completadas anteriores a `antes` y devuelve sus claves
  // temporales (una URL PUT reutilizada pudo dejar un objeto temporal huérfano).
  eliminarCompletadasAnteriores(antes: Date, limite: number): Promise<string[]>;
}

type FilaReserva = {
  id: string; propiedadId: string; tipo: TipoDocumento; nombreArchivo: string; mimeType: string;
  tamanoBytes: bigint; claveTemporal: string; claveDefinitiva: string; estado: EstadoSubida;
  expiraEn: Date; reclamadaEn: Date | null; documentoId: string | null;
};
const aReserva = (f: FilaReserva): Reserva => ({
  id: f.id, propiedadId: f.propiedadId, tipo: f.tipo, nombreArchivo: f.nombreArchivo, mimeType: f.mimeType,
  tamanoBytes: Number(f.tamanoBytes), claveTemporal: f.claveTemporal, claveDefinitiva: f.claveDefinitiva,
  estado: f.estado, expiraEn: f.expiraEn, reclamadaEn: f.reclamadaEn, documentoId: f.documentoId,
});

export function createReservasPrisma(prisma: PrismaClient): RepositorioReservas {
  const obtener = async (id: string) => {
    const fila = await prisma.documentoSubida.findUnique({ where: { id } });
    return fila ? aReserva(fila) : null;
  };
  return {
    async reservarConCuota(nueva, ahora) {
      return prisma.$transaction(async (tx) => {
        // Serializa las reservas: dos solicitudes simultáneas no pueden superar una cuota.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('documentos-cuota'))`;
        const [uso] = await tx.$queryRaw<{ docs: bigint; bytes_prop: bigint; bytes_global: bigint }[]>`
          SELECT
            (SELECT COUNT(*) FROM documento WHERE propiedad_id = ${nueva.propiedadId}::uuid)
              + (SELECT COUNT(*) FROM documento_subida WHERE propiedad_id = ${nueva.propiedadId}::uuid
                   AND estado IN ('PENDIENTE', 'EN_PROCESO') AND expira_en > ${ahora}::timestamptz) AS docs,
            COALESCE((SELECT SUM(tamano_bytes) FROM documento WHERE propiedad_id = ${nueva.propiedadId}::uuid), 0)
              + COALESCE((SELECT SUM(tamano_bytes) FROM documento_subida WHERE propiedad_id = ${nueva.propiedadId}::uuid
                   AND estado IN ('PENDIENTE', 'EN_PROCESO') AND expira_en > ${ahora}::timestamptz), 0) AS bytes_prop,
            COALESCE((SELECT SUM(tamano_bytes) FROM documento), 0)
              + COALESCE((SELECT SUM(tamano_bytes) FROM documento_subida
                   WHERE estado IN ('PENDIENTE', 'EN_PROCESO') AND expira_en > ${ahora}::timestamptz), 0) AS bytes_global`;
        const usoDocs: UsoDocumentos = {
          documentosPropiedad: Number(uso.docs),
          bytesPropiedad: Number(uso.bytes_prop),
          bytesGlobal: Number(uso.bytes_global),
        };
        const motivo = errorDeCuota(usoDocs, nueva.tamanoBytes);
        if (motivo) throw new UnprocessableError(motivo);
        const fila = await tx.documentoSubida.create({
          data: { ...nueva, tamanoBytes: BigInt(nueva.tamanoBytes) },
        });
        return aReserva(fila);
      });
    },
    obtener,
    async reclamar(id, ahora) {
      const abandono = new Date(ahora.getTime() - RECLAMO_ABANDONADO_SEGUNDOS * 1000);
      const { count } = await prisma.documentoSubida.updateMany({
        where: {
          id,
          expiraEn: { gt: ahora },
          OR: [{ estado: "PENDIENTE" }, { estado: "EN_PROCESO", reclamadaEn: { lt: abandono } }],
        },
        data: { estado: "EN_PROCESO", reclamadaEn: ahora },
      });
      if (count !== 1) return null;
      return obtener(id);
    },
    async liberar(id) {
      await prisma.documentoSubida.updateMany({
        where: { id, estado: "EN_PROCESO" },
        data: { estado: "PENDIENTE", reclamadaEn: null },
      });
    },
    async completar(reserva, datos) {
      return prisma.$transaction(async (tx) => {
        const doc = await tx.documento.create({
          data: {
            propiedadId: datos.propiedadId,
            tipo: datos.tipo,
            nombreArchivo: datos.nombreArchivo,
            mimeType: datos.mimeType,
            tamanoBytes: BigInt(datos.tamanoBytes),
            storageKey: datos.storageKey,
            ...datos.vinculo,
          },
        });
        await tx.documentoSubida.update({
          where: { id: reserva.id },
          data: { estado: "COMPLETADA", documentoId: doc.id },
        });
        return doc;
      });
    },
    documentoDe(documentoId) {
      return prisma.documento.findUnique({ where: { id: documentoId } });
    },
    async reclamarVencidas(antes, ahora, limite) {
      const abandono = new Date(ahora.getTime() - RECLAMO_ABANDONADO_SEGUNDOS * 1000);
      const candidatas = await prisma.documentoSubida.findMany({
        where: {
          expiraEn: { lt: antes },
          OR: [{ estado: "PENDIENTE" }, { estado: "EN_PROCESO", reclamadaEn: { lt: abandono } }, { estado: "EXPIRADA" }],
        },
        orderBy: { expiraEn: "asc" },
        take: limite,
      });
      const propias: Reserva[] = [];
      for (const c of candidatas) {
        if (c.estado === "EXPIRADA") {
          propias.push(aReserva(c)); // ya reclamada antes: se reintenta el borrado (idempotente)
          continue;
        }
        // Reclamo atómico: si una confirmación la tomó entretanto, no se toca.
        const { count } = await prisma.documentoSubida.updateMany({
          where: {
            id: c.id,
            expiraEn: { lt: antes },
            OR: [{ estado: "PENDIENTE" }, { estado: "EN_PROCESO", reclamadaEn: { lt: abandono } }],
          },
          data: { estado: "EXPIRADA" },
        });
        if (count === 1) propias.push({ ...aReserva(c), estado: "EXPIRADA" });
      }
      return propias;
    },
    async claveDefinitivaReferenciada(clave) {
      return (await prisma.documento.count({ where: { storageKey: clave } })) > 0;
    },
    async eliminar(ids) {
      if (ids.length === 0) return;
      await prisma.documentoSubida.deleteMany({ where: { id: { in: ids }, estado: { not: "COMPLETADA" } } });
    },
    async eliminarCompletadasAnteriores(antes, limite) {
      const filas = await prisma.documentoSubida.findMany({
        where: { estado: "COMPLETADA", creadaEn: { lt: antes } },
        select: { id: true, claveTemporal: true },
        take: limite,
      });
      if (filas.length === 0) return [];
      await prisma.documentoSubida.deleteMany({
        where: { id: { in: filas.map((f) => f.id) }, estado: "COMPLETADA" },
      });
      return filas.map((f) => f.claveTemporal);
    },
  };
}
