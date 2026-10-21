import { test } from "node:test";
import assert from "node:assert/strict";
import { propiedadInputSchema } from "../../server/schemas/propiedad";

const valida = {
  numeroDepartamento: "401-D",
  direccion: "Calle Ficticia 1",
  superficieM2: 45.5,
  valorCompraMonto: 2500,
  valorCompraMoneda: "UF",
  fechaCompra: "2024-02-29",
  estacionamiento: "E-1",
  bodega: "B-1",
};

function camposInvalidos(input: unknown): string[] {
  const result = propiedadInputSchema.safeParse(input);
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

test("entrada válida: montos normalizados a texto decimal", () => {
  const data = propiedadInputSchema.parse(valida);
  assert.equal(data.superficieM2, "45.5");
  assert.equal(data.valorCompraMonto, "2500");
  assert.equal(data.fechaCompra, "2024-02-29");
});

test("estacionamiento y bodega ausentes, nulos o vacíos → null", () => {
  const sin: Partial<typeof valida> = { ...valida };
  delete sin.estacionamiento;
  delete sin.bodega;
  const a = propiedadInputSchema.parse(sin);
  assert.equal(a.estacionamiento, null);
  assert.equal(a.bodega, null);
  const b = propiedadInputSchema.parse({ ...valida, estacionamiento: "  ", bodega: null, direccion: "" });
  assert.equal(b.estacionamiento, null);
  assert.equal(b.bodega, null);
  assert.equal(b.direccion, null);
});

test("superficie y monto deben ser mayores que 0", () => {
  assert.deepEqual(camposInvalidos({ ...valida, superficieM2: 0 }), ["superficieM2"]);
  assert.deepEqual(camposInvalidos({ ...valida, superficieM2: -3 }), ["superficieM2"]);
  assert.deepEqual(camposInvalidos({ ...valida, valorCompraMonto: "0.0000" }), ["valorCompraMonto"]);
});

test("superficie negativa indica que debe ser mayor que 0; texto no numérico no", () => {
  const mensaje = (superficieM2: unknown) => {
    const r = propiedadInputSchema.safeParse({ ...valida, superficieM2 });
    return r.success ? null : r.error.issues.map((i) => i.message);
  };
  assert.deepEqual(mensaje(-3), ["Debe ser mayor que 0"]);
  assert.deepEqual(mensaje("-0.5"), ["Debe ser mayor que 0"]);
  assert.deepEqual(mensaje("abc"), ["Debe ser un número decimal"]);
});

test("CLP no admite decimales; UF sí", () => {
  assert.deepEqual(
    camposInvalidos({ ...valida, valorCompraMoneda: "CLP", valorCompraMonto: 95000000.5 }),
    ["valorCompraMonto"]
  );
  assert.equal(
    propiedadInputSchema.parse({ ...valida, valorCompraMoneda: "CLP", valorCompraMonto: "95000000.00" })
      .valorCompraMoneda,
    "CLP"
  );
  assert.equal(propiedadInputSchema.parse({ ...valida, valorCompraMonto: 2500.1234 }).valorCompraMonto, "2500.1234");
});

test("excede precisión o rango de la columna", () => {
  assert.deepEqual(camposInvalidos({ ...valida, superficieM2: 45.123 }), ["superficieM2"]);
  assert.deepEqual(camposInvalidos({ ...valida, superficieM2: 1000000 }), ["superficieM2"]);
  assert.deepEqual(camposInvalidos({ ...valida, valorCompraMonto: 2500.12345 }), ["valorCompraMonto"]);
  assert.deepEqual(camposInvalidos({ ...valida, valorCompraMonto: "10000000000" }), ["valorCompraMonto"]);
});

test("fecha: formato inválido y fechas inexistentes", () => {
  for (const fechaCompra of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-5", "15/03/2021", ""]) {
    assert.deepEqual(camposInvalidos({ ...valida, fechaCompra }), ["fechaCompra"], fechaCompra);
  }
});

test("campos obligatorios y moneda inválida", () => {
  assert.deepEqual(camposInvalidos({ ...valida, numeroDepartamento: "   " }), ["numeroDepartamento"]);
  assert.deepEqual(camposInvalidos({ ...valida, valorCompraMoneda: "USD" }), ["valorCompraMoneda"]);
  assert.equal(propiedadInputSchema.safeParse(null).success, false);
});
