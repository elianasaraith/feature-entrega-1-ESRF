import { test } from "node:test";
import assert from "node:assert/strict";
import { movimientoEdicionSchema, movimientoInputSchema } from "../../server/schemas/movimiento";

// Validación de formato (→ 400). Las reglas de negocio (monto > 0, fecha no
// futura) las aplica el servicio (→ 422) y se prueban en la integración.
const valido = { fecha: "2026-03-04", categoria: "REPARACION", montoClp: "150000" };

test("movimiento válido: descripción opcional y normalizada", () => {
  assert.deepEqual(movimientoInputSchema.parse({ ...valido, descripcion: "  Gasfitería " }), {
    ...valido,
    descripcion: "Gasfitería",
  });
  assert.equal(movimientoInputSchema.parse(valido).descripcion, null);
  assert.equal(movimientoInputSchema.parse({ ...valido, descripcion: "  " }).descripcion, null);
});

test("las 7 categorías pasan; DIVIDENDO y desconocidas se rechazan", () => {
  for (const categoria of [
    "REPARACION",
    "EQUIPAMIENTO",
    "SEGURO",
    "CONTRIBUCIONES",
    "GASTO_COMUN",
    "GASTO_EXTRAORDINARIO",
    "OTRO",
  ]) {
    assert.equal(movimientoInputSchema.parse({ ...valido, categoria }).categoria, categoria);
  }
  for (const categoria of ["DIVIDENDO", "reparacion", "", undefined]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, categoria }), `categoría ${categoria}`);
  }
});

test("el monto numérico se normaliza a texto; 0 y negativos pasan el formato", () => {
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: 450000 }).montoClp, "450000");
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: "0" }).montoClp, "0");
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: "-5" }).montoClp, "-5");
});

test("monto con formato inválido o fuera de rango se rechaza", () => {
  for (const montoClp of ["abc", "1.5", "", "1e3", "12 000", "123456789012345"]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, montoClp }), `monto ${montoClp}`);
  }
});

test("fecha con formato o calendario inválido se rechaza", () => {
  for (const fecha of ["2026-02-30", "04-03-2026", "2026-3-4", "", undefined]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, fecha }), `fecha ${fecha}`);
  }
});

test("un campo `tipo` se ignora: el resultado no lo contiene", () => {
  const r = movimientoInputSchema.parse({ ...valido, tipo: "INGRESO" });
  assert.equal("tipo" in r, false);
});

// --- Desglose en conceptos (ampliación de T07) -------------------------------
const conceptos = [
  { nombre: "Materiales", montoClp: "60000" },
  { nombre: "Mano de obra", montoClp: "70000" },
  { nombre: "Transporte", montoClp: "20000" },
];
const sinMonto = { fecha: "2026-03-04", categoria: "REPARACION" };

// Mensajes agrupados por campo, como los entrega toHttpResponse.
function campos(schema: typeof movimientoInputSchema, entrada: unknown): string[] {
  const r = schema.safeParse(entrada);
  assert.equal(r.success, false);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

test("gasto simple sin `conceptos`: la salida es idéntica a la de antes (sin clave conceptos)", () => {
  for (const schema of [movimientoInputSchema, movimientoEdicionSchema]) {
    const r = schema.parse(valido);
    assert.equal("conceptos" in r, false);
    assert.deepEqual(r, { ...valido, descripcion: null });
  }
});

test("desglosado válido: conceptos normalizados y montoClp opcional", () => {
  const r = movimientoInputSchema.parse({ ...sinMonto, conceptos: [{ nombre: "  Materiales ", montoClp: 60000 }] });
  assert.deepEqual(r.conceptos, [{ nombre: "Materiales", montoClp: "60000" }]);
  assert.equal("montoClp" in r, false);
  assert.equal(movimientoInputSchema.parse({ ...sinMonto, montoClp: "150000", conceptos }).montoClp, "150000");
});

test("nombres repetidos se permiten", () => {
  const dos = [
    { nombre: "Materiales", montoClp: "1" },
    { nombre: "Materiales", montoClp: "2" },
  ];
  assert.equal(movimientoInputSchema.parse({ ...sinMonto, conceptos: dos }).conceptos?.length, 2);
});

test("nombre vacío, solo espacios, ausente o de más de 100 caracteres → 400 en conceptos.N.nombre", () => {
  for (const nombre of ["", "   ", undefined, "x".repeat(101)]) {
    const rutas = campos(movimientoInputSchema, { ...sinMonto, conceptos: [{ nombre, montoClp: "10" }] });
    assert.ok(rutas.includes("conceptos.0.nombre"), `nombre ${JSON.stringify(nombre)?.slice(0, 12)}`);
  }
  assert.equal(
    movimientoInputSchema.parse({ ...sinMonto, conceptos: [{ nombre: "x".repeat(100), montoClp: "10" }] }).conceptos?.length,
    1
  );
});

test("monto de concepto: formato inválido o fuera de rango → 400; 0 y negativos pasan el formato", () => {
  for (const montoClp of ["abc", "1.5", "", "1e3", "123456789012345", undefined]) {
    const rutas = campos(movimientoInputSchema, { ...sinMonto, conceptos: [{ nombre: "A", montoClp }] });
    assert.ok(rutas.includes("conceptos.0.montoClp"), `monto ${String(montoClp)}`);
  }
  for (const montoClp of ["0", "-5"]) {
    assert.equal(movimientoInputSchema.safeParse({ ...sinMonto, conceptos: [{ nombre: "A", montoClp }] }).success, true);
  }
});

test("más de 50 conceptos → 400 en conceptos; 50 se aceptan", () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => ({ nombre: `c${i}`, montoClp: "1" }));
  assert.equal(movimientoInputSchema.parse({ ...sinMonto, conceptos: n(50) }).conceptos?.length, 50);
  assert.ok(campos(movimientoInputSchema, { ...sinMonto, conceptos: n(51) }).includes("conceptos"));
  assert.ok(campos(movimientoEdicionSchema, { ...sinMonto, conceptos: n(51) }).includes("conceptos"));
});

test("`conceptos: null` → 400 en conceptos, en el alta y en la edición", () => {
  for (const schema of [movimientoInputSchema, movimientoEdicionSchema]) {
    assert.ok(campos(schema, { ...valido, conceptos: null }).includes("conceptos"));
    assert.ok(campos(schema, { ...sinMonto, montoClp: "10", conceptos: null }).includes("conceptos"));
  }
});

test("`conceptos` que no es una lista → 400", () => {
  assert.ok(campos(movimientoInputSchema, { ...valido, conceptos: "Materiales" }).includes("conceptos"));
  assert.ok(campos(movimientoInputSchema, { ...valido, conceptos: {} }).includes("conceptos"));
});

test("alta: sin conceptos o con lista vacía exige montoClp → 400 en montoClp", () => {
  assert.deepEqual(campos(movimientoInputSchema, sinMonto), ["montoClp"]);
  assert.deepEqual(campos(movimientoInputSchema, { ...sinMonto, conceptos: [] }), ["montoClp"]);
  assert.equal(movimientoInputSchema.parse({ ...valido, conceptos: [] }).montoClp, "150000");
});

test("edición: montoClp puede omitirse con `conceptos` ausente; con [] es obligatorio", () => {
  const r = movimientoEdicionSchema.parse(sinMonto);
  assert.equal("montoClp" in r, false);
  assert.equal("conceptos" in r, false);
  assert.deepEqual(campos(movimientoEdicionSchema, { ...sinMonto, conceptos: [] }), ["montoClp"]);
  assert.equal(movimientoEdicionSchema.parse({ ...valido, conceptos: [] }).montoClp, "150000");
});

test("la ausencia de `conceptos` se distingue de la lista vacía en la salida", () => {
  assert.equal("conceptos" in movimientoEdicionSchema.parse(valido), false);
  assert.deepEqual(movimientoEdicionSchema.parse({ ...valido, conceptos: [] }).conceptos, []);
});

test("los demás campos se validan igual con conceptos (categoría, fecha, DIVIDENDO)", () => {
  assert.ok(campos(movimientoInputSchema, { ...sinMonto, conceptos, categoria: "DIVIDENDO" }).includes("categoria"));
  assert.ok(campos(movimientoInputSchema, { ...sinMonto, conceptos, fecha: "2026-02-30" }).includes("fecha"));
});
