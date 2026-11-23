import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { UF_MAX_CONCURRENCIA, createUfService } from "../../server/uf/uf-service";
import type { ProveedorUf, ResultadoUf } from "../../server/uf/proveedor";

// Sin base de datos ni red: Prisma se sustituye por un almacén en memoria con la
// misma semántica que usa el servicio (findMany por períodos y createMany que
// ignora duplicados) y el proveedor por un doble que mide las llamadas simultáneas.
type Fila = { periodo: Date; valorClp: Prisma.Decimal; fechaValor: Date; fuente: string };

function prismaEnMemoria(previas: Fila[] = []) {
  const filas = new Map<string, Fila>(previas.map((f) => [f.periodo.toISOString(), f]));
  let createMany = 0;
  const prisma = {
    valorUfPeriodo: {
      async findMany({ where }: { where: { periodo: { in: Date[] } } }) {
        return where.periodo.in
          .map((d) => filas.get(d.toISOString()))
          .filter((f): f is Fila => f !== undefined);
      },
      async createMany({ data }: { data: Fila[]; skipDuplicates: boolean }) {
        createMany++;
        for (const f of data) if (!filas.has(f.periodo.toISOString())) filas.set(f.periodo.toISOString(), f);
        return { count: data.length };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, filas, llamadasCreateMany: () => createMany };
}

function proveedorMedido(falla: (fecha: string) => boolean = () => false) {
  let enVuelo = 0;
  let maximo = 0;
  const fechas: string[] = [];
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha): Promise<ResultadoUf> {
      fechas.push(fecha);
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 5));
      enVuelo--;
      if (falla(fecha)) return { tipo: "error", motivo: "HTTP 500" };
      return { tipo: "ok", valorClp: new Prisma.Decimal("100.00"), fechaValor: fecha };
    },
  };
  return { proveedor, fechas, maximo: () => maximo };
}

const periodos = (n: number) =>
  Array.from({ length: n }, (_, i) => `${2000 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
const silencio = () => {};

test("el límite por defecto es de seis llamadas simultáneas", () => {
  assert.equal(UF_MAX_CONCURRENCIA, 6);
});

test("nunca supera seis llamadas simultáneas y procesa todos los períodos", async () => {
  const { prisma, filas } = prismaEnMemoria();
  const medido = proveedorMedido();
  const svc = createUfService(prisma, medido.proveedor, silencio);
  const todos = periodos(40);
  const r = await svc.obtenerValores(todos);
  assert.equal(medido.maximo(), 6);
  assert.equal(medido.fechas.length, 40);
  assert.equal(r.size, 40);
  assert.equal(filas.size, 40);
  for (const p of todos) assert.equal(r.get(p)?.valorClp, "100.00");
});

test("el límite es configurable y los períodos con error no impiden procesar los demás", async () => {
  const { prisma } = prismaEnMemoria();
  const medido = proveedorMedido((f) => f.endsWith("-03-01"));
  const svc = createUfService(prisma, medido.proveedor, silencio, 2);
  const todos = periodos(24);
  const r = await svc.obtenerValores(todos);
  assert.ok(medido.maximo() <= 2);
  assert.equal(medido.fechas.length, 24);
  assert.equal(r.size, 22); // los dos marzos fallan y no figuran
  assert.equal(r.has("2000-03"), false);
  assert.equal(r.has("2000-04"), true);
});

test("el límite solo aplica a períodos no almacenados; los duplicados se consultan una vez", async () => {
  const almacenados: Fila[] = periodos(30).map((p) => ({
    periodo: new Date(`${p}-01T00:00:00.000Z`),
    valorClp: new Prisma.Decimal("50.00"),
    fechaValor: new Date(`${p}-01T00:00:00.000Z`),
    fuente: "previa",
  }));
  const { prisma } = prismaEnMemoria(almacenados);
  const medido = proveedorMedido();
  const svc = createUfService(prisma, medido.proveedor, silencio);
  const nuevos = ["2030-01", "2030-02", "2030-03"];
  const r = await svc.obtenerValores([...periodos(30), ...nuevos, ...nuevos]);
  assert.deepEqual([...medido.fechas].sort(), nuevos.map((p) => `${p}-01`));
  assert.ok(medido.maximo() <= 3);
  assert.equal(r.size, 33);
  assert.equal(r.get("2000-01")?.valorClp, "50.00"); // lo almacenado no se toca
});

// --- Corte anticipado (umbral de 6 fallos consecutivos) ---
import { UF_UMBRAL_FALLOS } from "../../server/uf/uf-service";

type Salida = "ok" | "error" | "sin-datos" | "lanza";
function proveedorGuionado(salida: (n: number, fecha: string) => Salida, demoraMs = 5) {
  let enVuelo = 0;
  let maximo = 0;
  let llamadas = 0;
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha): Promise<ResultadoUf> {
      const n = ++llamadas;
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, demoraMs));
      enVuelo--;
      const s = salida(n, fecha);
      if (s === "lanza") throw new Error("boom");
      if (s === "error") return { tipo: "error", motivo: "timeout" };
      if (s === "sin-datos") return { tipo: "sin-datos" };
      return { tipo: "ok", valorClp: new Prisma.Decimal("100.00"), fechaValor: fecha };
    },
  };
  return { proveedor, llamadas: () => llamadas, maximo: () => maximo };
}

test("el umbral por defecto es de seis fallos consecutivos", () => {
  assert.equal(UF_UMBRAL_FALLOS, 6);
});

test("36 períodos con el proveedor caído: se detienen las nuevas consultas al llegar al umbral", async () => {
  const { prisma, filas } = prismaEnMemoria();
  const p = proveedorGuionado(() => "error");
  const logs: string[] = [];
  const r = await createUfService(prisma, p.proveedor, (m) => logs.push(m)).obtenerValores(periodos(36));
  // Cota: umbral + concurrencia − 1 consultas iniciadas como máximo.
  assert.ok(p.llamadas() >= 6 && p.llamadas() <= 6 + 6 - 1, `llamadas: ${p.llamadas()}`);
  assert.ok(p.llamadas() < 36);
  assert.ok(p.maximo() <= 6);
  assert.equal(r.size, 0); // sin equivalentes: nunca estimados
  assert.equal(filas.size, 0); // no se persisten errores
  assert.ok(logs.some((m) => m.includes("sin consultar")));
});

test("también cuentan como fallo las excepciones del proveedor", async () => {
  const { prisma } = prismaEnMemoria();
  const p = proveedorGuionado(() => "lanza");
  await createUfService(prisma, p.proveedor, silencio).obtenerValores(periodos(36));
  assert.ok(p.llamadas() < 36);
});

test("respuestas válidas intercaladas reinician el contador: no se activa el corte", async () => {
  const { prisma } = prismaEnMemoria();
  // Con una sola consulta a la vez el orden es determinista: 5 fallos, 1 válida, ...
  const p = proveedorGuionado((n) => (n % 6 === 0 ? "ok" : "error"));
  const svc = createUfService(prisma, p.proveedor, silencio, 1);
  const r = await svc.obtenerValores(periodos(36));
  assert.equal(p.llamadas(), 36);
  assert.equal(r.size, 6); // las seis válidas
});

test("la serie vacía no cuenta como fallo ni como caída", async () => {
  const { prisma, filas } = prismaEnMemoria();
  const p = proveedorGuionado(() => "sin-datos");
  const r = await createUfService(prisma, p.proveedor, silencio).obtenerValores(periodos(36));
  assert.equal(p.llamadas(), 36);
  assert.equal(r.size, 0);
  assert.equal(filas.size, 0); // tampoco se persiste
});

test("sin-datos entre fallos reinicia el contador (el proveedor respondió)", async () => {
  const { prisma } = prismaEnMemoria();
  const p = proveedorGuionado((n) => (n % 6 === 0 ? "sin-datos" : "error"));
  await createUfService(prisma, p.proveedor, silencio, 1).obtenerValores(periodos(36));
  assert.equal(p.llamadas(), 36);
});

test("los valores almacenados siguen disponibles aunque el proveedor esté caído", async () => {
  const almacenados: Fila[] = periodos(12).map((x) => ({
    periodo: new Date(`${x}-01T00:00:00.000Z`),
    valorClp: new Prisma.Decimal("50.00"),
    fechaValor: new Date(`${x}-01T00:00:00.000Z`),
    fuente: "previa",
  }));
  const { prisma } = prismaEnMemoria(almacenados);
  const p = proveedorGuionado(() => "error");
  const nuevos = periodos(60).slice(12);
  const r = await createUfService(prisma, p.proveedor, silencio).obtenerValores([...periodos(12), ...nuevos]);
  assert.equal(r.size, 12);
  for (const x of periodos(12)) assert.equal(r.get(x)?.valorClp, "50.00");
  assert.ok(p.llamadas() < nuevos.length);
});

test("las consultas ya iniciadas terminan y sus valores válidos se conservan tras el corte", async () => {
  const { prisma, filas } = prismaEnMemoria();
  // Las 6 primeras fallan rápido (provocan el corte); las siguientes en vuelo son
  // lentas pero válidas: deben completarse y persistirse.
  let n = 0;
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha): Promise<ResultadoUf> {
      const i = ++n;
      if (i <= 6) {
        await new Promise((r) => setTimeout(r, i)); // 1..6 ms, fallan en orden
        return { tipo: "error", motivo: "HTTP 500" };
      }
      await new Promise((r) => setTimeout(r, 30)); // iniciadas antes del corte, terminan después
      return { tipo: "ok", valorClp: new Prisma.Decimal("77.00"), fechaValor: fecha };
    },
  };
  const r = await createUfService(prisma, proveedor, silencio).obtenerValores(periodos(36));
  assert.ok(n < 36);
  assert.ok(n > 6, "debieron iniciarse algunas antes del corte");
  assert.equal(r.size, n - 6); // todas las válidas iniciadas se conservan
  assert.equal(filas.size, n - 6);
  for (const v of r.values()) assert.equal(v.valorClp, "77.00");
});

test("una nueva ejecución no hereda el contador ni el corte", async () => {
  const { prisma } = prismaEnMemoria();
  let caido = true;
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha): Promise<ResultadoUf> {
      await new Promise((r) => setTimeout(r, 2));
      return caido
        ? { tipo: "error", motivo: "timeout" }
        : { tipo: "ok", valorClp: new Prisma.Decimal("10.00"), fechaValor: fecha };
    },
  };
  const svc = createUfService(prisma, proveedor, silencio);
  assert.equal((await svc.obtenerValores(periodos(36))).size, 0); // corta
  caido = false;
  const r = await svc.obtenerValores(periodos(36)); // misma instancia, ejecución nueva
  assert.equal(r.size, 36);
});

test("el umbral es configurable", async () => {
  const { prisma } = prismaEnMemoria();
  const p = proveedorGuionado(() => "error");
  await createUfService(prisma, p.proveedor, silencio, 1, 2).obtenerValores(periodos(36));
  assert.equal(p.llamadas(), 2); // concurrencia 1, umbral 2
});
