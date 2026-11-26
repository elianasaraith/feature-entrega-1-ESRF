import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etiquetaCalificacionPago,
  flujoNeto,
  formatearClp,
  formatearUf,
  ordenarActividad,
  seleccionarSaldoAplicable,
  sumarMontos,
} from "../../server/domain/dashboard";

test("flujo neto: negativo, positivo y cero", () => {
  assert.equal(flujoNeto("500000", "650000"), "-150000");
  assert.equal(flujoNeto("650000", "500000"), "150000");
  assert.equal(flujoNeto("0", "0"), "0");
});

test("sumarMontos: lista vacía y montos enormes sin pérdida de precisión", () => {
  assert.equal(sumarMontos([]), "0");
  assert.equal(sumarMontos(["99999999999999", "1"]), "100000000000000");
});

test("actividad: fecha descendente y desempate por origen y luego id", () => {
  const items = [
    { id: "a", origen: "ABONO" as const, fecha: "2026-03-05", concepto: "x", montoClp: "1" },
    { id: "m", origen: "MOVIMIENTO" as const, fecha: "2026-03-20", concepto: "x", montoClp: "1" },
    { id: "d", origen: "DIVIDENDO" as const, fecha: "2026-03-10", concepto: "x", montoClp: "1" },
    { id: "z", origen: "MOVIMIENTO" as const, fecha: "2026-03-05", concepto: "x", montoClp: "1" },
    { id: "b", origen: "MOVIMIENTO" as const, fecha: "2026-03-05", concepto: "x", montoClp: "1" },
  ];
  assert.deepEqual(
    ordenarActividad(items).map((i) => i.id),
    ["m", "d", "a", "b", "z"]
  );
  assert.deepEqual(ordenarActividad([]), []);
});

test("saldo aplicable: mes intermedio, futuro, anterior a todo y nulos ignorados", () => {
  const regs = [
    { periodo: "2026-03", saldoPendienteUf: "900.5" },
    { periodo: "2026-01", saldoPendienteUf: "1000" },
    { periodo: "2026-02", saldoPendienteUf: null },
    { periodo: "2026-05", saldoPendienteUf: "800" },
  ];
  assert.deepEqual(seleccionarSaldoAplicable(regs, "2026-02"), { periodo: "2026-01", saldoPendienteUf: "1000" });
  assert.deepEqual(seleccionarSaldoAplicable(regs, "2026-03"), { periodo: "2026-03", saldoPendienteUf: "900.5" });
  assert.deepEqual(seleccionarSaldoAplicable(regs, "2030-01"), { periodo: "2026-05", saldoPendienteUf: "800" });
  assert.equal(seleccionarSaldoAplicable(regs, "2025-12"), null);
  assert.equal(seleccionarSaldoAplicable([], "2026-03"), null);
});

test("formatos: CLP con miles sin decimales y UF hasta 4 decimales", () => {
  assert.equal(formatearClp("1234567"), "1.234.567");
  assert.equal(formatearClp("-150000"), "-150.000");
  assert.equal(formatearClp("0"), "0");
  assert.equal(formatearClp("999"), "999");
  assert.equal(formatearUf("1234.5"), "1.234,5");
  assert.equal(formatearUf("12.3456"), "12,3456");
  assert.equal(formatearUf("1000"), "1.000");
  assert.equal(formatearUf("0.5"), "0,5");
});

test("calificación del pago: solo cuando corresponde", () => {
  const base = { vencidoConAbonosParciales: false, pagadoConAtraso: false };
  assert.equal(etiquetaCalificacionPago(base), null);
  assert.equal(
    etiquetaCalificacionPago({ ...base, vencidoConAbonosParciales: true }),
    "vencido con abonos parciales"
  );
  assert.equal(etiquetaCalificacionPago({ ...base, pagadoConAtraso: true }), "pagado con atraso");
});
