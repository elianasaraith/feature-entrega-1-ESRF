import type { PrismaClient, ValorUfPeriodo } from "@prisma/client";
import type { ProveedorUf } from "./proveedor";

// Servicio de UF bajo demanda (docs/architecture.md §12.2). Orden: primero la
// base de datos; solo los períodos sin fila se consultan al proveedor. Un valor
// almacenado NUNCA se sobrescribe (inserción idempotente + relectura). Sin dato
// válido el período queda fuera del resultado: no se estima, no se interpola y
// no se usa el valor de otro período.

export type ValorUfDto = {
  periodo: string; // YYYY-MM
  valorClp: string; // texto decimal, 2 decimales
  fechaValor: string; // YYYY-MM-DD
  fuente: string;
};

// Máximo de consultas HTTP simultáneas al proveedor por invocación. Solo aplica a
// los períodos sin valor almacenado.
export const UF_MAX_CONCURRENCIA = 6;

// Corte anticipado: tras este número de fallos CONSECUTIVOS del proveedor (error,
// timeout o excepción), una invocación de `obtenerValores` deja de iniciar nuevas
// consultas. Sin estado entre invocaciones.
export const UF_UMBRAL_FALLOS = 6;

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

// Política del día de referencia (decisión aprobada: día 1). Único punto donde
// se define; cambiarla no exige tocar el esquema ni el proveedor.
export function fechaReferenciaPeriodo(periodo: string): string {
  if (!PERIODO.test(periodo)) throw new RangeError(`Período inválido: ${periodo}`);
  return `${periodo}-01`;
}

function periodoADate(periodo: string): Date {
  return new Date(`${fechaReferenciaPeriodo(periodo)}T00:00:00.000Z`);
}

function toDto(fila: ValorUfPeriodo): ValorUfDto {
  return {
    periodo: fila.periodo.toISOString().slice(0, 7),
    valorClp: fila.valorClp.toFixed(2),
    fechaValor: fila.fechaValor.toISOString().slice(0, 10),
    fuente: fila.fuente,
  };
}

// Procesa `items` con a lo sumo `limite` tareas en vuelo; conserva el orden.
async function conLimite<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  async function trabajador(): Promise<void> {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await tarea(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

export type UfService = ReturnType<typeof createUfService>;

export function createUfService(
  prisma: PrismaClient,
  proveedor: ProveedorUf,
  log: (mensaje: string) => void = (m) => console.error(m),
  maxConcurrencia: number = UF_MAX_CONCURRENCIA,
  umbralFallos: number = UF_UMBRAL_FALLOS,
) {
  async function leer(periodos: string[]): Promise<ValorUfDto[]> {
    if (periodos.length === 0) return [];
    const filas = await prisma.valorUfPeriodo.findMany({
      where: { periodo: { in: periodos.map(periodoADate) } },
    });
    return filas.map(toDto);
  }

  return {
    // Devuelve solo los períodos con valor disponible; los ausentes no figuran.
    async obtenerValores(periodos: string[]): Promise<Map<string, ValorUfDto>> {
      const unicos = [...new Set(periodos)];
      unicos.forEach(fechaReferenciaPeriodo); // valida el formato de entrada
      const resultado = new Map<string, ValorUfDto>();
      for (const v of await leer(unicos)) resultado.set(v.periodo, v);

      const faltantes = unicos.filter((p) => !resultado.has(p));

      // Corte anticipado. Estado local a esta invocación (JS es monohilo: cada
      // continuación actualiza el contador sin carreras). «Consecutivos» se mide en
      // orden de finalización. Falla = error, timeout, excepción o respuesta
      // inconsistente; reinician el contador una respuesta válida y una serie vacía
      // (el proveedor respondió). Al alcanzar el umbral se deja de INICIAR consultas;
      // las ya iniciadas terminan y sus valores válidos se conservan. Una vez
      // cortada, la invocación no se reanuda. Como mucho se inician
      // umbral + concurrencia − 1 consultas.
      let fallosConsecutivos = 0;
      let cortado = false;
      let omitidos = 0;
      const registrarFalla = () => {
        fallosConsecutivos++;
        if (!cortado && fallosConsecutivos >= umbralFallos) {
          cortado = true;
          log(`UF: ${fallosConsecutivos} fallos consecutivos del proveedor; se detienen nuevas consultas`);
        }
      };

      const obtenidos = await conLimite(faltantes, Math.max(1, maxConcurrencia), async (periodo) => {
        if (cortado) {
          omitidos++;
          return null; // sin consultar: queda sin equivalente, nunca estimado
        }
        const fecha = fechaReferenciaPeriodo(periodo);
        try {
          const r = await proveedor.obtener(fecha);
          if (r.tipo === "ok" && r.fechaValor === fecha && r.valorClp.gt(0)) {
            fallosConsecutivos = 0;
            return { periodo, valorClp: r.valorClp, fechaValor: r.fechaValor };
          }
          if (r.tipo === "sin-datos") {
            fallosConsecutivos = 0; // ausencia legítima: no es una caída
            return null;
          }
          log(
            r.tipo === "error"
              ? `UF ${fecha} no disponible: ${r.motivo}`
              : `UF ${fecha} descartada: respuesta inconsistente`
          );
          registrarFalla();
        } catch {
          log(`UF ${fecha} no disponible: el proveedor lanzó una excepción`);
          registrarFalla();
        }
        return null;
      });
      if (omitidos > 0) log(`UF: ${omitidos} período(s) sin consultar por el corte anticipado`);

      const nuevos = obtenidos.filter((o): o is NonNullable<typeof o> => o !== null);
      if (nuevos.length > 0) {
        await prisma.valorUfPeriodo.createMany({
          data: nuevos.map((n) => ({
            periodo: periodoADate(n.periodo),
            valorClp: n.valorClp,
            fechaValor: periodoADate(n.periodo),
            fuente: proveedor.fuente,
            obtenidoEn: new Date(),
          })),
          skipDuplicates: true, // ON CONFLICT DO NOTHING: nunca sobrescribe
        });
        // Relectura: gana lo almacenado, también ante una inserción concurrente.
        for (const v of await leer(nuevos.map((n) => n.periodo))) resultado.set(v.periodo, v);
      }
      return resultado;
    },
  };
}
