import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type AbonoEntrada,
  calcularEstadoPago,
  ordenarAbonos,
} from "../../server/domain/pago-estado";

// Tabla de verdad de docs/data-model.md §6.1. Datos ficticios.
const ESPERADA = "2026-03-05";
let n = 0;
const abono = (montoClp: string, fechaRecepcion: string, createdAt?: string): AbonoEntrada => {
  n += 1;
  return {
    id: `a-${String(n).padStart(3, "0")}`,
    montoClp,
    fechaRecepcion,
    createdAt: createdAt ?? `2026-03-01T00:00:${String(n % 60).padStart(2, "0")}.000Z`,
  };
};
const pago = (montoEsperadoClp: string, abonos: AbonoEntrada[], fechaEsperada = ESPERADA) => ({
  montoEsperadoClp,
  fechaEsperada,
  abonos,
});

test("PENDIENTE: sin abonos y sin vencer", () => {
  const r = calcularEstadoPago(pago("600000", []), "2026-03-01");
  assert.equal(r.estado, "PENDIENTE");
  assert.equal(r.recibidoClp, "0");
  assert.equal(r.saldoPendienteClp, "600000");
  assert.equal(r.fechaCompletitud, null);
  assert.equal(r.vencidoConAbonosParciales, false);
  assert.equal(r.pagadoConAtraso, false);
});

test("la fecha esperada igual a hoy no está vencida", () => {
  assert.equal(calcularEstadoPago(pago("600000", []), ESPERADA).estado, "PENDIENTE");
  assert.equal(calcularEstadoPago(pago("600000", []), "2026-03-06").estado, "VENCIDO");
});

test("PARCIALMENTE_PAGADO: abonos parciales sin vencer", () => {
  const r = calcularEstadoPago(pago("600000", [abono("200000", "2026-03-02")]), "2026-03-03");
  assert.equal(r.estado, "PARCIALMENTE_PAGADO");
  assert.equal(r.recibidoClp, "200000");
  assert.equal(r.saldoPendienteClp, "400000");
  assert.equal(r.vencidoConAbonosParciales, false);
});

test("VENCIDO sin abonos: sin calificación de parciales", () => {
  const r = calcularEstadoPago(pago("600000", []), "2026-03-20");
  assert.equal(r.estado, "VENCIDO");
  assert.equal(r.saldoPendienteClp, "600000");
  assert.equal(r.vencidoConAbonosParciales, false);
});

test("CL11: vencido con abonos parciales muestra recibido y saldo", () => {
  const r = calcularEstadoPago(pago("600000", [abono("250000", "2026-03-04")]), "2026-03-20");
  assert.equal(r.estado, "VENCIDO");
  assert.equal(r.vencidoConAbonosParciales, true);
  assert.equal(r.recibidoClp, "250000");
  assert.equal(r.saldoPendienteClp, "350000");
  assert.equal(r.fechaCompletitud, null);
});

test("AC1: un abono exacto deja el pago PAGADO a tiempo", () => {
  const r = calcularEstadoPago(pago("600000", [abono("600000", "2026-03-05")]), "2026-03-20");
  assert.equal(r.estado, "PAGADO");
  assert.equal(r.fechaCompletitud, "2026-03-05");
  assert.equal(r.pagadoConAtraso, false);
  assert.equal(r.saldoPendienteClp, "0");
});

test("AC1: varios abonos suman el esperado; completa el segundo", () => {
  const r = calcularEstadoPago(
    pago("600000", [abono("300000", "2026-03-03"), abono("300000", "2026-03-04")]),
    "2026-03-10"
  );
  assert.equal(r.estado, "PAGADO");
  assert.equal(r.fechaCompletitud, "2026-03-04");
  assert.equal(r.pagadoConAtraso, false);
});

test("pagado con atraso: completa después de la fecha esperada", () => {
  const r = calcularEstadoPago(
    pago("600000", [abono("300000", "2026-03-04"), abono("300000", "2026-03-12")]),
    "2026-03-20"
  );
  assert.equal(r.estado, "PAGADO");
  assert.equal(r.fechaCompletitud, "2026-03-12");
  assert.equal(r.pagadoConAtraso, true);
  assert.equal(r.vencidoConAbonosParciales, false);
});

test("CL14: sobrepago → PAGADO, saldo 0 y recibido refleja el total", () => {
  const r = calcularEstadoPago(pago("600000", [abono("620000", "2026-03-04")]), "2026-03-10");
  assert.equal(r.estado, "PAGADO");
  assert.equal(r.recibidoClp, "620000");
  assert.equal(r.saldoPendienteClp, "0");
});

test("CL12: reajuste retroactivo con fecha vencida → VENCIDO con parciales, saldo 30.000", () => {
  const r = calcularEstadoPago(pago("530000", [abono("500000", "2026-03-04")]), "2026-03-20");
  assert.equal(r.estado, "VENCIDO");
  assert.equal(r.vencidoConAbonosParciales, true);
  assert.equal(r.saldoPendienteClp, "30000");
  assert.equal(r.fechaCompletitud, null);
});

test("CL13: mismo reajuste sin vencer → PARCIALMENTE_PAGADO, saldo 30.000", () => {
  const r = calcularEstadoPago(pago("530000", [abono("500000", "2026-03-02")]), "2026-03-03");
  assert.equal(r.estado, "PARCIALMENTE_PAGADO");
  assert.equal(r.saldoPendienteClp, "30000");
});

test("CL14: un reajuste que baja el esperado adelanta la fecha de completitud", () => {
  const abonos = [abono("300000", "2026-03-02"), abono("300000", "2026-03-08")];
  const antes = calcularEstadoPago(pago("600000", abonos), "2026-03-20");
  const despues = calcularEstadoPago(pago("300000", abonos), "2026-03-20");
  assert.equal(antes.fechaCompletitud, "2026-03-08");
  assert.equal(antes.pagadoConAtraso, true);
  assert.equal(despues.fechaCompletitud, "2026-03-02");
  assert.equal(despues.pagadoConAtraso, false);
  assert.equal(despues.recibidoClp, "600000");
});

test("quitar un abono hace perder el estado PAGADO (regla 2)", () => {
  const a = abono("300000", "2026-03-03");
  const b = abono("300000", "2026-03-04");
  assert.equal(calcularEstadoPago(pago("600000", [a, b]), "2026-03-20").estado, "PAGADO");
  assert.equal(calcularEstadoPago(pago("600000", [a]), "2026-03-20").estado, "VENCIDO");
  assert.equal(calcularEstadoPago(pago("600000", [a]), "2026-03-04").estado, "PARCIALMENTE_PAGADO");
});

test("el estado cambia solo por el paso del tiempo", () => {
  const p = pago("600000", []);
  assert.equal(calcularEstadoPago(p, "2026-03-05").estado, "PENDIENTE");
  assert.equal(calcularEstadoPago(p, "2026-03-06").estado, "VENCIDO");
});

test("abonos el mismo día: orden determinista por created_at e id", () => {
  const x = { id: "b", montoClp: "400000", fechaRecepcion: "2026-03-04", createdAt: "2026-03-04T10:00:00.000Z" };
  const y = { id: "a", montoClp: "400000", fechaRecepcion: "2026-03-04", createdAt: "2026-03-04T10:00:00.000Z" };
  const z = { id: "c", montoClp: "400000", fechaRecepcion: "2026-03-04", createdAt: "2026-03-04T09:00:00.000Z" };
  assert.deepEqual(ordenarAbonos([x, y, z]).map((a) => a.id), ["c", "a", "b"]);
  const r1 = calcularEstadoPago(pago("600000", [x, y, z]), "2026-03-10");
  const r2 = calcularEstadoPago(pago("600000", [z, y, x]), "2026-03-10");
  assert.deepEqual(r1, r2);
  assert.equal(r1.fechaCompletitud, "2026-03-04");
});

test("montos grandes no pierden precisión (bigint)", () => {
  const r = calcularEstadoPago(
    pago("99999999999999", [abono("99999999999998", "2026-03-04")]),
    "2026-03-20"
  );
  assert.equal(r.saldoPendienteClp, "1");
  assert.equal(r.estado, "VENCIDO");
});
