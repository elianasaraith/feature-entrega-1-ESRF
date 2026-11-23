import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEquivalenteClp } from "../../server/uf/equivalente";
import type { ValorUfDto } from "../../server/uf/uf-service";

// Valores fijos solo para pruebas: no representan la UF real.
const uf = (valorClp: string, fechaValor = "2026-03-01"): ValorUfDto => ({
  periodo: fechaValor.slice(0, 7),
  valorClp,
  fechaValor,
  fuente: "doble-pruebas",
});

test("conversión exacta de 25.4321 UF con una UF de 39796.31", () => {
  const r = calcularEquivalenteClp("25.4321", uf("39796.31"));
  assert.equal(r?.valorClp, "1012103.735551");
});

test("UF ausente: null", () => {
  assert.equal(calcularEquivalenteClp("25.4321", undefined), null);
});

test("monto ausente: null, incluso con UF disponible", () => {
  assert.equal(calcularEquivalenteClp(null, uf("39796.31")), null);
});

test("monto y UF ausentes: null", () => {
  assert.equal(calcularEquivalenteClp(null, undefined), null);
});

test("preserva los decimales sin redondear ni perder precisión", () => {
  assert.equal(calcularEquivalenteClp("0.1", uf("39796.31"))?.valorClp, "3979.631");
  assert.equal(
    calcularEquivalenteClp("99999999.9999", uf("39796.31"))?.valorClp,
    "3979630999996.020369", // producto decimal exacto (verificado fuera de JS)
  );
  assert.equal(calcularEquivalenteClp("0", uf("39796.31"))?.valorClp, "0");
});

test("propaga la fecha de referencia y la UF utilizadas", () => {
  const r = calcularEquivalenteClp("10", uf("30000.50", "2024-03-01"));
  assert.deepEqual(r, {
    valorClp: "300005",
    ufClp: "30000.50",
    fechaReferencia: "2024-03-01",
  });
});

test("no modifica los datos de entrada", () => {
  const entrada = uf("39796.31");
  const copia = { ...entrada };
  calcularEquivalenteClp("1", entrada);
  assert.deepEqual(entrada, copia);
});

// --- Presentación (redondeo solo aquí) ---
import {
  etiquetaMes,
  formatearMontoClp,
  formatearValorUf,
  referenciasUf,
} from "../../server/uf/equivalente";

test("formatea CLP redondeado a entero, sin repetir la UF ni la fecha", () => {
  const eq = calcularEquivalenteClp("25.4321", uf("39796.31"));
  assert.ok(eq);
  assert.equal(formatearMontoClp(eq), "$ 1.012.104");
});

test("redondeo mitad hacia arriba solo al presentar; el DTO conserva el exacto", () => {
  const medio = { valorClp: "100.5", ufClp: "1", fechaReferencia: "2026-03-01" };
  const debajo = { valorClp: "100.4999", ufClp: "1", fechaReferencia: "2026-03-01" };
  assert.equal(formatearMontoClp(medio), "$ 101");
  assert.equal(formatearMontoClp(debajo), "$ 100");
  assert.equal(medio.valorClp, "100.5");
});

test("referenciasUf: ninguna referencia disponible → lista vacía", () => {
  assert.deepEqual(referenciasUf([null, null, null]), []);
  assert.deepEqual(referenciasUf([]), []);
});

test("referenciasUf: varios montos con la misma UF no la duplican", () => {
  const a = calcularEquivalenteClp("35", uf("41252.94", "2026-11-01"));
  const b = calcularEquivalenteClp("10", uf("41252.94", "2026-11-01"));
  assert.deepEqual(referenciasUf([a, null, b]), [
    { fechaReferencia: "2026-11-01", ufClp: "41252.94" },
  ]);
});

test("referenciasUf: varias referencias, de la más reciente a la más antigua", () => {
  const nov = calcularEquivalenteClp("1", uf("41252.94", "2026-11-01"));
  const feb = calcularEquivalenteClp("1", uf("39000.10", "2024-02-01"));
  const oct = calcularEquivalenteClp("1", uf("40000.00", "2026-10-01"));
  assert.deepEqual(
    referenciasUf([feb, nov, oct, nov]).map((r) => r.fechaReferencia),
    ["2026-11-01", "2026-10-01", "2024-02-01"]
  );
});

test("etiquetas de mes y valor de la UF", () => {
  assert.equal(etiquetaMes("2026-11-01"), "noviembre 2026");
  assert.equal(etiquetaMes("2024-02-01", true), "feb 2024");
  assert.equal(formatearValorUf({ fechaReferencia: "2026-11-01", ufClp: "41252.94" }), "UF $ 41.252,94");
});
