import { Prisma } from "@prisma/client";
import type { Documento } from "@prisma/client";
import { RECLAMO_ABANDONADO_SEGUNDOS, errorDeCuota } from "../../server/domain/documento";
import { UnprocessableError } from "../../server/errors";
import type { DatosDocumento, RepositorioReservas, Reserva } from "../../server/services/documento-reservas";

// Implementación en memoria del puerto de reservas para las pruebas unitarias. Cada método
// es atómico (sin `await` entre la comprobación y la escritura), como la versión
// PostgreSQL; esa se verifica contra una base real en tests/documentos/*.integration.test.ts.
export function createReservasMemoria(documentos: Documento[], opciones: { fallaCompletar?: () => boolean } = {}) {
  const filas = new Map<string, Reserva>();
  let contador = 0;
  const vigente = (r: Reserva, ahora: Date) => (r.estado === "PENDIENTE" || r.estado === "EN_PROCESO") && r.expiraEn > ahora;
  const repo: RepositorioReservas = {
    async reservarConCuota(nueva, ahora) {
      const prop = documentos.filter((d) => d.propiedadId === nueva.propiedadId);
      const activas = [...filas.values()].filter((r) => vigente(r, ahora));
      const delProp = activas.filter((r) => r.propiedadId === nueva.propiedadId);
      const suma = (xs: { tamanoBytes: number | bigint }[]) => xs.reduce((a, x) => a + Number(x.tamanoBytes), 0);
      const motivo = errorDeCuota(
        {
          documentosPropiedad: prop.length + delProp.length,
          bytesPropiedad: suma(prop) + suma(delProp),
          bytesGlobal: suma(documentos) + suma(activas),
        },
        nueva.tamanoBytes
      );
      if (motivo) throw new UnprocessableError(motivo);
      const r: Reserva = { ...nueva, id: `00000000-0000-4000-9000-${String(++contador).padStart(12, "0")}`, estado: "PENDIENTE", reclamadaEn: null, documentoId: null };
      filas.set(r.id, r);
      return { ...r };
    },
    async obtener(id) {
      const r = filas.get(id);
      return r ? { ...r } : null;
    },
    async reclamar(id, ahora) {
      const r = filas.get(id);
      if (!r || r.expiraEn <= ahora) return null;
      const abandonada = r.estado === "EN_PROCESO" && r.reclamadaEn !== null && r.reclamadaEn.getTime() < ahora.getTime() - RECLAMO_ABANDONADO_SEGUNDOS * 1000;
      if (r.estado !== "PENDIENTE" && !abandonada) return null;
      r.estado = "EN_PROCESO";
      r.reclamadaEn = ahora;
      return { ...r };
    },
    async liberar(id) {
      const r = filas.get(id);
      if (r && r.estado === "EN_PROCESO") {
        r.estado = "PENDIENTE";
        r.reclamadaEn = null;
      }
    },
    async completar(reserva, datos: DatosDocumento) {
      if (opciones.fallaCompletar?.()) throw new Error("falla de base de datos");
      if (documentos.some((d) => d.storageKey === datos.storageKey)) {
        throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
      }
      const doc = {
        id: `00000000-0000-4000-a000-${String(1000 + documentos.length).padStart(12, "0")}`,
        creditoId: null, contratoId: null, abonoArriendoId: null, movimientoFinancieroId: null,
        subidoEn: new Date("2026-11-23T10:00:00Z"),
        propiedadId: datos.propiedadId, tipo: datos.tipo, nombreArchivo: datos.nombreArchivo, mimeType: datos.mimeType,
        tamanoBytes: BigInt(datos.tamanoBytes), storageKey: datos.storageKey, ...datos.vinculo,
      } as Documento;
      documentos.push(doc);
      const r = filas.get(reserva.id)!;
      r.estado = "COMPLETADA";
      r.documentoId = doc.id;
      return doc;
    },
    async documentoDe(id) {
      return documentos.find((d) => d.id === id) ?? null;
    },
    async reclamarVencidas(antes, ahora, limite) {
      const abandono = ahora.getTime() - RECLAMO_ABANDONADO_SEGUNDOS * 1000;
      const propias: Reserva[] = [];
      for (const r of filas.values()) {
        if (propias.length >= limite || r.expiraEn >= antes) continue;
        const abandonada = r.estado === "PENDIENTE" || (r.estado === "EN_PROCESO" && (r.reclamadaEn?.getTime() ?? 0) < abandono);
        if (abandonada) r.estado = "EXPIRADA";
        if (abandonada || r.estado === "EXPIRADA") propias.push({ ...r });
      }
      return propias;
    },
    async claveDefinitivaReferenciada(clave) {
      return documentos.some((d) => d.storageKey === clave);
    },
    async eliminar(ids) {
      for (const id of ids) if (filas.get(id)?.estado !== "COMPLETADA") filas.delete(id);
    },
    async eliminarCompletadasAnteriores(antes, limite) {
      const claves: string[] = [];
      for (const [id, r] of filas) {
        // La memoria no guarda `creadaEn`: expiraEn - 10 min equivale a la creación.
        if (claves.length < limite && r.estado === "COMPLETADA" && r.expiraEn.getTime() - 600_000 < antes.getTime()) {
          filas.delete(id);
          claves.push(r.claveTemporal);
        }
      }
      return claves;
    },
  };
  return { repo, filas };
}
