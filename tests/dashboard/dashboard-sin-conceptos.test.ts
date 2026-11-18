import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guarda de contrato (sin base de datos): T09 contabiliza los egresos manuales
// solo con `movimiento_financiero.monto_clp`, que en un gasto desglosado ya es la
// suma de sus conceptos. Si T09 empezara a leer los conceptos (include, relación
// o tabla), un gasto desglosado podría contarse dos veces. La contraparte con
// base de datos está en dashboard-service.integration.test.ts (SQL real emitido).
const FUENTES = [
  "server/services/dashboard-service.ts",
  "server/domain/dashboard.ts",
  "app/api/dashboard/route.ts",
  "app/api/propiedades/[id]/resumen-mensual/route.ts",
];

// `concepto` (singular) es una etiqueta de la actividad reciente y no cuenta.
const LECTURA_DE_CONCEPTOS = /movimientoConcepto|MovimientoConcepto|movimiento_concepto|\bconceptos\b/;

test("T09 no lee la relación ni la tabla de conceptos de un movimiento", () => {
  for (const ruta of FUENTES) {
    const texto = readFileSync(join(process.cwd(), ruta), "utf8");
    assert.equal(LECTURA_DE_CONCEPTOS.test(texto), false, `${ruta} no debe leer conceptos`);
  }
});

test("T09 sí lee el monto del movimiento padre", () => {
  const texto = readFileSync(join(process.cwd(), "server/services/dashboard-service.ts"), "utf8");
  assert.match(texto, /prisma\.movimientoFinanciero\.findMany/);
  assert.match(texto, /m\.montoClp/);
});
