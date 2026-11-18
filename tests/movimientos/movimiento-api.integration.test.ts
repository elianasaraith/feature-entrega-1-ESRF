import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { PrismaClient } from "@prisma/client";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import { destinoDe, resolveTestDatabase } from "../setup/test-db";

// Pruebas HTTP de los Route Handlers de movimientos (T07 + desglose). Se invocan
// las funciones GET/POST/PUT/DELETE con un `Request` real; solo se simula la
// SESIÓN, porque `requireSession` depende del contexto de petición de Next.js.
//
// SEGURIDAD: los handlers usan el cliente Prisma global (`@/server/db/client`,
// que lee DATABASE_URL). Antes de importarlos se apunta DATABASE_URL a la base de
// pruebas, y solo si `resolveTestDatabase` verificó que NO es la de desarrollo.
// Sin TEST_DATABASE_URL todo se omite y no se importa ningún handler: nunca se
// escribe en `realtytrack`. Cada prueba borra por id lo que creó. Datos ficticios.
const { url: testUrl, skip } = resolveTestDatabase();

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Coleccion = { GET: Handler; POST: Handler };
type Item = { GET: Handler; PUT: Handler; DELETE: Handler };

let coleccion: Coleccion;
let item: Item;
let sesionActiva = true; // false → requireSession responde 401, como el real

const prisma = skip ? (null as unknown as PrismaClient) : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const propiedadesCreadas: string[] = [];
const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

before(async () => {
  if (skip) return;
  // 1. Las rutas escribirán en la base de pruebas (verificada), nunca en la de desarrollo.
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  assert.deepEqual(destinoDe(process.env.DATABASE_URL as string), destinoDe(testUrl as string));

  // 2. Solo la sesión se simula: mismo contrato que server/auth/require-session.ts.
  const modulo = Module as unknown as { _load: (request: string, ...resto: unknown[]) => unknown };
  const cargaOriginal = modulo._load;
  modulo._load = function cargaConSesionSimulada(request: string, ...resto: unknown[]) {
    if (request === "@/server/auth/require-session") {
      return {
        requireSession: async () =>
          sesionActiva
            ? { user: { email: "prueba@example.com" }, expires: "2999-01-01T00:00:00.000Z" }
            : new Response(JSON.stringify({ error: "No autenticado" }), {
                status: 401,
                headers: { "content-type": "application/json" },
              }),
      };
    }
    return cargaOriginal.call(this, request, ...resto);
  };

  coleccion = (await import("../../app/api/propiedades/[id]/movimientos/route")) as unknown as Coleccion;
  item = (await import("../../app/api/propiedades/[id]/movimientos/[movId]/route")) as unknown as Item;
});

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    await prisma.movimientoFinanciero.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  await prisma.$disconnect();
  const global = globalThis as { __prisma?: PrismaClient };
  await global.__prisma?.$disconnect();
});

async function nuevaPropiedad() {
  const dto = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: "TEST-API-1",
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "2024-05-10",
    })
  );
  propiedadesCreadas.push(dto.id);
  return dto.id;
}

const peticion = (method: string, cuerpo?: unknown, url = "http://localhost/api/movimientos") =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

const ctx = (id: string, movId?: string) => ({
  params: Promise.resolve<Record<string, string>>(movId ? { id, movId } : { id }),
});

type Cuerpo = Record<string, unknown>;
const json = async (r: Response) => (await r.json()) as Cuerpo & { conceptos: { nombre: string; montoClp: string; orden: number }[] };

const CONCEPTOS = [
  { nombre: "Materiales", montoClp: "60000" },
  { nombre: "Mano de obra", montoClp: "70000" },
  { nombre: "Transporte", montoClp: "20000" },
];
const BASE = { fecha: "2026-03-10", categoria: "REPARACION" };

const crear = (id: string, cuerpo: Cuerpo) => coleccion.POST(peticion("POST", cuerpo), ctx(id));
const editar = (id: string, movId: string, cuerpo: Cuerpo) => item.PUT(peticion("PUT", cuerpo), ctx(id, movId));
const consultar = async (id: string, movId: string) => json(await item.GET(peticion("GET"), ctx(id, movId)));
const filasDeConceptos = (movId: string) => prisma.movimientoConcepto.count({ where: { movimientoFinancieroId: movId } });

async function nuevoDesglosado(id: string, extra: Cuerpo = {}) {
  const r = await crear(id, { ...BASE, conceptos: CONCEPTOS, ...extra });
  assert.equal(r.status, 201);
  return json(r);
}

test("POST de un gasto desglosado: 201, total calculado y conceptos en orden", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id, { descripcion: "Baño" });
  assert.equal(m.montoClp, "150000");
  assert.deepEqual(m.conceptos.map((c) => [c.nombre, c.montoClp, c.orden]), [
    ["Materiales", "60000", 0],
    ["Mano de obra", "70000", 1],
    ["Transporte", "20000", 2],
  ]);
  assert.equal(await filasDeConceptos(m.id as string), 3);
});

test("GET del movimiento y del listado devuelven los conceptos; un simple trae []", { skip }, async () => {
  const id = await nuevaPropiedad();
  const des = await nuevoDesglosado(id);
  const simple = await json(await crear(id, { ...BASE, montoClp: "100000" })); // cuerpo anterior, sin conceptos
  assert.equal(simple.montoClp, "100000");
  assert.deepEqual(simple.conceptos, []);

  assert.deepEqual((await consultar(id, des.id as string)).conceptos, des.conceptos);

  const lista = (await (await coleccion.GET(peticion("GET", undefined, "http://localhost/x?mes=2026-03"), ctx(id))).json()) as {
    movimientos: { id: string; conceptos: unknown[] }[];
    totalClp: string;
  };
  assert.equal(lista.movimientos.length, 2); // no 5: los conceptos no son movimientos
  assert.equal(lista.totalClp, "250000"); // 150.000 + 100.000, el desglosado cuenta una vez
  const porId = Object.fromEntries(lista.movimientos.map((m) => [m.id, m.conceptos.length]));
  assert.deepEqual(porId, { [des.id as string]: 3, [simple.id as string]: 0 });
});

test("PUT sin `conceptos` ni `montoClp` conserva el desglose y el total", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const r = await editar(id, m.id as string, { fecha: "2026-04-01", categoria: "SEGURO", descripcion: "Solo cambia esto" });
  assert.equal(r.status, 200);
  const editado = await json(r);
  assert.equal(editado.fecha, "2026-04-01");
  assert.equal(editado.categoria, "SEGURO");
  assert.equal(editado.descripcion, "Solo cambia esto");
  assert.equal(editado.montoClp, "150000");
  assert.deepEqual(editado.conceptos, m.conceptos);
  assert.deepEqual((await consultar(id, m.id as string)).conceptos, m.conceptos);
});

test("PUT sin `conceptos` con el montoClp actual se acepta (cliente anterior)", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const r = await editar(id, m.id as string, { ...BASE, montoClp: "150000", descripcion: "Cliente anterior" });
  assert.equal(r.status, 200);
  const editado = await json(r);
  assert.equal(editado.descripcion, "Cliente anterior");
  assert.deepEqual(editado.conceptos, m.conceptos);
});

test("PUT con montoClp inconsistente → 422 y no cambia nada", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const antes = await consultar(id, m.id as string);

  const sinConceptos = await editar(id, m.id as string, { fecha: "2026-05-01", categoria: "OTRO", descripcion: "x", montoClp: "100000" });
  assert.equal(sinConceptos.status, 422);
  const discordante = await editar(id, m.id as string, {
    ...BASE,
    montoClp: "999",
    conceptos: [{ nombre: "Otro", montoClp: "1000" }],
  });
  assert.equal(discordante.status, 422);
  const conceptoCero = await editar(id, m.id as string, { ...BASE, conceptos: [{ nombre: "Cero", montoClp: "0" }] });
  assert.equal(conceptoCero.status, 422);

  assert.deepEqual(await consultar(id, m.id as string), antes); // incluye updatedAt: no se escribió
  assert.equal(await filasDeConceptos(m.id as string), 3);
});

test("PUT con `conceptos: []` convierte explícitamente a simple y elimina el desglose", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const r = await editar(id, m.id as string, { ...BASE, conceptos: [], montoClp: "150000" });
  assert.equal(r.status, 200);
  const simple = await json(r);
  assert.equal(simple.id, m.id);
  assert.equal(simple.montoClp, "150000");
  assert.deepEqual(simple.conceptos, []);
  assert.equal(await filasDeConceptos(m.id as string), 0);
});

test("PUT con `conceptos: []` sin monto → 400; con monto ≤ 0 → 422; ninguno cambia el desglose", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const antes = await consultar(id, m.id as string);

  const sinMonto = await editar(id, m.id as string, { ...BASE, conceptos: [] });
  assert.equal(sinMonto.status, 400);
  assert.ok((await json(sinMonto)).campos);
  assert.equal((await editar(id, m.id as string, { ...BASE, conceptos: [], montoClp: "0" })).status, 422);

  assert.deepEqual(await consultar(id, m.id as string), antes);
  assert.equal(await filasDeConceptos(m.id as string), 3);
});

test("`conceptos: null` → 400 en PUT y en POST, sin alterar ni crear nada", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const antes = await consultar(id, m.id as string);

  const put = await editar(id, m.id as string, { ...BASE, montoClp: "150000", conceptos: null });
  assert.equal(put.status, 400);
  const cuerpoPut = (await put.json()) as { error: string; campos: Record<string, string[]> };
  assert.equal(cuerpoPut.error, "Entrada inválida");
  assert.ok(cuerpoPut.campos.conceptos);

  const post = await crear(id, { ...BASE, montoClp: "10", conceptos: null });
  assert.equal(post.status, 400);
  assert.ok(((await post.json()) as { campos: Record<string, string[]> }).campos.conceptos);

  assert.deepEqual(await consultar(id, m.id as string), antes);
  assert.equal(await prisma.movimientoFinanciero.count({ where: { propiedadId: id } }), 1); // solo el original
});

test("POST desglosado inválido: nombre vacío → 400; concepto ≤ 0 o suma discordante → 422; no se crea nada", { skip }, async () => {
  const id = await nuevaPropiedad();
  const vacio = await crear(id, { ...BASE, conceptos: [{ nombre: "  ", montoClp: "10" }] });
  assert.equal(vacio.status, 400);
  assert.ok(((await vacio.json()) as { campos: Record<string, string[]> }).campos["conceptos.0.nombre"]);

  assert.equal((await crear(id, { ...BASE, conceptos: [{ nombre: "A", montoClp: "0" }] })).status, 422);
  assert.equal((await crear(id, { ...BASE, conceptos: CONCEPTOS, montoClp: "140000" })).status, 422);
  assert.equal((await crear(id, { ...BASE, conceptos: CONCEPTOS, fecha: "2999-01-01" })).status, 422);
  assert.equal(await prisma.movimientoFinanciero.count({ where: { propiedadId: id } }), 0);
});

test("compatibilidad: el cuerpo anterior de gastos simples sigue dando los mismos códigos", { skip }, async () => {
  const id = await nuevaPropiedad();
  const r = await crear(id, { ...BASE, montoClp: 45000, descripcion: "Gasfitería" });
  assert.equal(r.status, 201);
  const m = await json(r);
  assert.equal(m.montoClp, "45000");

  assert.equal((await editar(id, m.id as string, { ...BASE, montoClp: "30000" })).status, 200);
  assert.equal((await consultar(id, m.id as string)).montoClp, "30000");
  // Sin monto sobre un simple: 400 con campos.montoClp, como antes.
  const sinMonto = await editar(id, m.id as string, BASE);
  assert.equal(sinMonto.status, 400);
  assert.ok(((await sinMonto.json()) as { campos: Record<string, string[]> }).campos.montoClp);
  assert.equal((await editar(id, m.id as string, { ...BASE, montoClp: "0" })).status, 422);
  assert.equal((await crear(id, { ...BASE, montoClp: "-5" })).status, 422);
  assert.equal((await crear(id, { ...BASE, montoClp: "1.5" })).status, 400);
  assert.equal((await crear(id, { ...BASE, categoria: "DIVIDENDO", montoClp: "10" })).status, 400);
  assert.equal((await consultar(id, m.id as string)).montoClp, "30000");
});

test("DELETE → 204 y elimina los conceptos; otra propiedad o ids inválidos → 404 sin alterar", { skip }, async () => {
  const a = await nuevaPropiedad();
  const b = await nuevaPropiedad();
  const m = await nuevoDesglosado(a);
  const antes = await consultar(a, m.id as string);

  assert.equal((await item.DELETE(peticion("DELETE"), ctx(b, m.id as string))).status, 404);
  assert.equal((await editar(b, m.id as string, { ...BASE, montoClp: "150000" })).status, 404);
  assert.equal((await item.GET(peticion("GET"), ctx(b, m.id as string))).status, 404);
  assert.equal((await item.GET(peticion("GET"), ctx(a, "no-es-uuid"))).status, 404);
  assert.equal((await crear(INEXISTENTE, { ...BASE, montoClp: "1" })).status, 404);
  assert.deepEqual(await consultar(a, m.id as string), antes);

  assert.equal((await item.DELETE(peticion("DELETE"), ctx(a, m.id as string))).status, 204);
  assert.equal(await filasDeConceptos(m.id as string), 0);
  assert.equal((await item.GET(peticion("GET"), ctx(a, m.id as string))).status, 404);
});

test("sin sesión todas las rutas responden 401 y no tocan la base", { skip }, async () => {
  const id = await nuevaPropiedad();
  const m = await nuevoDesglosado(id);
  const antes = await consultar(id, m.id as string);
  sesionActiva = false;
  try {
    const respuestas = [
      await coleccion.GET(peticion("GET"), ctx(id)),
      await coleccion.POST(peticion("POST", { ...BASE, conceptos: CONCEPTOS }), ctx(id)),
      await item.GET(peticion("GET"), ctx(id, m.id as string)),
      await item.PUT(peticion("PUT", { ...BASE, conceptos: [], montoClp: "1" }), ctx(id, m.id as string)),
      await item.DELETE(peticion("DELETE"), ctx(id, m.id as string)),
    ];
    for (const r of respuestas) {
      assert.equal(r.status, 401);
      assert.deepEqual(await r.json(), { error: "No autenticado" });
    }
  } finally {
    sesionActiva = true;
  }
  assert.deepEqual(await consultar(id, m.id as string), antes);
  assert.equal(await prisma.movimientoFinanciero.count({ where: { propiedadId: id } }), 1);
});

// Estas dos no leen ni escriben: el formato (400) y la sesión (401) se resuelven
// antes de llegar al servicio, así que usan ids inexistentes.
test("formato: `conceptos: null` y otros errores de forma → 400 antes de tocar la base", { skip }, async () => {
  const nulo = await coleccion.POST(peticion("POST", { ...BASE, montoClp: "1", conceptos: null }), ctx(INEXISTENTE));
  assert.equal(nulo.status, 400);
  assert.ok(((await nulo.json()) as { campos: Record<string, string[]> }).campos.conceptos);
  const put = await item.PUT(peticion("PUT", { ...BASE, montoClp: "1", conceptos: null }), ctx(INEXISTENTE, INEXISTENTE));
  assert.equal(put.status, 400);
  const noLista = await coleccion.POST(peticion("POST", { ...BASE, montoClp: "1", conceptos: "Materiales" }), ctx(INEXISTENTE));
  assert.equal(noLista.status, 400);
  const muchos = Array.from({ length: 51 }, (_, i) => ({ nombre: `c${i}`, montoClp: "1" }));
  assert.equal((await coleccion.POST(peticion("POST", { ...BASE, conceptos: muchos }), ctx(INEXISTENTE))).status, 400);
  const cuerpoInvalido = await coleccion.POST(new Request("http://localhost/x", { method: "POST", body: "no es json" }), ctx(INEXISTENTE));
  assert.equal(cuerpoInvalido.status, 400);
});

test("sesión: sin sesión las cinco rutas responden 401 antes de leer el cuerpo", { skip }, async () => {
  sesionActiva = false;
  try {
    const respuestas = [
      await coleccion.GET(peticion("GET"), ctx(INEXISTENTE)),
      await coleccion.POST(peticion("POST", { ...BASE, conceptos: null }), ctx(INEXISTENTE)),
      await item.GET(peticion("GET"), ctx(INEXISTENTE, INEXISTENTE)),
      await item.PUT(peticion("PUT", { ...BASE, conceptos: null }), ctx(INEXISTENTE, INEXISTENTE)),
      await item.DELETE(peticion("DELETE"), ctx(INEXISTENTE, INEXISTENTE)),
    ];
    for (const r of respuestas) {
      assert.equal(r.status, 401); // y no 400: la sesión se comprueba primero
      assert.deepEqual(await r.json(), { error: "No autenticado" });
    }
  } finally {
    sesionActiva = true;
  }
});
