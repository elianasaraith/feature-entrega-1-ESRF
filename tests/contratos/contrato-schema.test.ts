import { test } from "node:test";
import assert from "node:assert/strict";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import {
  contratoActualizarSchema as actualizar,
  contratoCrearSchema as crear,
} from "../../server/schemas/contrato";

// Sin BD: solo validación de entrada. Datos ficticios.

const ID = "00000000-0000-4000-8000-000000000001";
const base = {
  fechaInicio: "2026-03-10",
  fechaTermino: "2027-03-09",
  diaEsperadoPago: 5,
  arrendatarioId: ID,
};

function campos(r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return r.success ? [] : (r.error?.issues.map((i) => i.path.join(".")) ?? []);
}

test("alta con arrendatario existente: garantía y monto como texto, opcionales en null", () => {
  const r = crear.parse({ ...base, garantiaClp: 500000, montoMensualClp: "450000" });
  assert.equal(r.garantiaClp, "500000");
  assert.equal(r.montoMensualClp, "450000");
  const sin = crear.parse(base);
  assert.equal(sin.garantiaClp, null);
  assert.equal(sin.montoMensualClp, null);
  assert.equal(sin.observaciones, null);
});

test("alta con arrendatario anidado", () => {
  const { arrendatarioId: _omit, ...resto } = base;
  void _omit;
  const r = crear.parse({ ...resto, arrendatario: { nombre: " Persona Ficticia " } });
  assert.equal(r.arrendatario?.nombre, "Persona Ficticia");
  assert.equal(r.arrendatario?.rut, null);
});

test("arrendatario ambiguo: ambos o ninguno → error", () => {
  assert.deepEqual(
    campos(crear.safeParse({ ...base, arrendatario: { nombre: "X" } })),
    ["arrendatarioId"]
  );
  const { arrendatarioId: _omit, ...resto } = base;
  void _omit;
  assert.deepEqual(campos(crear.safeParse(resto)), ["arrendatarioId"]);
});

test("término anterior al inicio → error en fechaTermino; igual al inicio se acepta", () => {
  assert.deepEqual(
    campos(crear.safeParse({ ...base, fechaTermino: "2026-03-09" })),
    ["fechaTermino"]
  );
  assert.ok(crear.safeParse({ ...base, fechaTermino: "2026-03-10" }).success);
});

test("día esperado de pago: 1 y 31 válidos; 0, 32 y decimales rechazados", () => {
  assert.ok(crear.safeParse({ ...base, diaEsperadoPago: 1 }).success);
  assert.ok(crear.safeParse({ ...base, diaEsperadoPago: 31 }).success);
  for (const dia of [0, 32, 5.5, "5", null]) {
    assert.deepEqual(campos(crear.safeParse({ ...base, diaEsperadoPago: dia })), ["diaEsperadoPago"]);
  }
});

test("fecha inexistente en el calendario", () => {
  assert.deepEqual(campos(crear.safeParse({ ...base, fechaInicio: "2026-02-30" })), ["fechaInicio"]);
});

test("garantía: 0 y vacío aceptados; negativa y decimales rechazados", () => {
  assert.equal(crear.parse({ ...base, garantiaClp: "0" }).garantiaClp, "0");
  assert.equal(crear.parse({ ...base, garantiaClp: "" }).garantiaClp, null);
  assert.deepEqual(campos(crear.safeParse({ ...base, garantiaClp: "-1" })), ["garantiaClp"]);
  assert.deepEqual(campos(crear.safeParse({ ...base, garantiaClp: "10.5" })), ["garantiaClp"]);
});

test("monto inicial: 0, negativo, decimales y exceso de 14 dígitos rechazados", () => {
  for (const monto of ["0", "-5", "1000.5", "123456789012345"]) {
    assert.deepEqual(campos(crear.safeParse({ ...base, montoMensualClp: monto })), ["montoMensualClp"]);
  }
});

test("edición: arrendatarioId obligatorio y montoMensualClp descartado", () => {
  const r = actualizar.parse({ ...base, montoMensualClp: "999999" });
  assert.equal("montoMensualClp" in r, false);
  const { arrendatarioId: _omit, ...resto } = base;
  void _omit;
  assert.deepEqual(campos(actualizar.safeParse(resto)), ["arrendatarioId"]);
});

test("arrendatario: nombre obligatorio y opcionales vacíos → null", () => {
  assert.deepEqual(campos(arrendatarioInputSchema.safeParse({ nombre: "   " })), ["nombre"]);
  const r = arrendatarioInputSchema.parse({ nombre: "A", rut: "", email: " ", telefono: null });
  assert.deepEqual(r, { nombre: "A", rut: null, email: null, telefono: null });
});
