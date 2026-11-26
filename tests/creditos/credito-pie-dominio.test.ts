import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPieEstimado } from "../../server/domain/credito-pie";
import { porcentaje } from "../../app/_lib/format";

// Monto estimado del pie: valor de compra × porcentaje / 100 en la moneda original.
test("UF: 20 % de 2000 UF → 400 UF y resto 80", () => {
  assert.deepEqual(calcularPieEstimado("2000", "UF", "20"), {
    montoEstimado: "400.0000",
    moneda: "UF",
    restoPorcentaje: "80",
  });
});

test("UF: decimales exactos, redondeo a 4 decimales half-up solo al final", () => {
  // 1234.5678 × 12.34 / 100 = 152.34566652 → 152.3457
  assert.equal(calcularPieEstimado("1234.5678", "UF", "12.34")?.montoEstimado, "152.3457");
  // 0.0001 × 50 / 100 = 0.00005 → half-up a 0.0001
  assert.equal(calcularPieEstimado("0.0001", "UF", "50")?.montoEstimado, "0.0001");
});

test("CLP: entero, half-up, sin conversión a UF", () => {
  assert.deepEqual(calcularPieEstimado("100000001", "CLP", "12.5"), {
    montoEstimado: "12500000",
    moneda: "CLP",
    restoPorcentaje: "87.5",
  });
  // 100000001 × 12.5 % = 12500000.125 → 12500000 ; 5 × 10 % = 0.5 → 1
  assert.equal(calcularPieEstimado("5", "CLP", "10")?.montoEstimado, "1");
});

test("sin pérdida de precisión con montos grandes (sin Number)", () => {
  // 99999999999999 × 0,3333 = 33329999999999,6667 → 33330000000000
  assert.equal(calcularPieEstimado("99999999999999", "CLP", "33.33")?.montoEstimado, "33330000000000");
});

test("0 % → monto 0 y resto 100 (distinto de null); 100 % → resto 0", () => {
  assert.deepEqual(calcularPieEstimado("2000", "UF", "0"), {
    montoEstimado: "0.0000",
    moneda: "UF",
    restoPorcentaje: "100",
  });
  assert.equal(calcularPieEstimado("2000", "UF", "100")?.restoPorcentaje, "0");
  assert.equal(calcularPieEstimado("2000", "UF", "100")?.montoEstimado, "2000.0000");
});

test("null → null; fuera de rango lanza", () => {
  assert.equal(calcularPieEstimado("2000", "UF", null), null);
  assert.throws(() => calcularPieEstimado("2000", "UF", "100.01"), RangeError);
  assert.throws(() => calcularPieEstimado("2000", "UF", "-1"), RangeError);
});

test("formato de porcentaje", () => {
  assert.equal(porcentaje("20"), "20 %");
  assert.equal(porcentaje("20.5"), "20,5 %");
  assert.equal(porcentaje("0"), "0 %");
});
