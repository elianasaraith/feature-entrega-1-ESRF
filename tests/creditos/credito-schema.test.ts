import { test } from "node:test";
import assert from "node:assert/strict";
import { creditoInputSchema } from "../../server/schemas/credito";

const valida = {
  banco: "Banco Ficticio",
  cuotaContractualUf: "12.3456",
  tasaInteresAnual: "4.1250",
  numeroCuotasTotal: 240,
  diaVencimiento: 5,
};

function camposInvalidos(input: unknown): string[] {
  const result = creditoInputSchema.safeParse(input);
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

test("solo obligatorios: opcionales quedan en null", () => {
  const d = creditoInputSchema.parse(valida);
  assert.equal(d.numeroCredito, null);
  assert.equal(d.fechaOtorgamiento, null);
  assert.equal(d.montoOriginalUf, null);
  assert.equal(d.segurosUf, null);
  assert.equal(d.saldoInicialUf, null);
});

test("completo válido, con opcionales vacíos normalizados a null", () => {
  const d = creditoInputSchema.parse({
    ...valida,
    numeroCredito: "  ",
    fechaOtorgamiento: "2024-02-29",
    montoOriginalUf: 2500,
    segurosUf: "0",
    saldoInicialUf: "",
  });
  assert.equal(d.numeroCredito, null);
  assert.equal(d.fechaOtorgamiento, "2024-02-29");
  assert.equal(d.montoOriginalUf, "2500");
  assert.equal(d.segurosUf, "0");
  assert.equal(d.saldoInicialUf, null);
});

test("precisión decimal preservada como texto", () => {
  const d = creditoInputSchema.parse(valida);
  assert.equal(d.cuotaContractualUf, "12.3456");
  assert.equal(d.tasaInteresAnual, "4.1250");
  assert.equal(d.numeroCuotasTotal, 240);
});

test("falta cada campo obligatorio", () => {
  for (const campo of Object.keys(valida)) {
    const resto = Object.fromEntries(Object.entries(valida).filter(([k]) => k !== campo));
    assert.ok(camposInvalidos(resto).includes(campo), campo);
  }
});

test("banco solo espacios es inválido", () => {
  assert.deepEqual(camposInvalidos({ ...valida, banco: "   " }), ["banco"]);
});

test("cuota ≤ 0 y monto original ≤ 0 son inválidos", () => {
  assert.deepEqual(camposInvalidos({ ...valida, cuotaContractualUf: 0 }), ["cuotaContractualUf"]);
  assert.deepEqual(camposInvalidos({ ...valida, cuotaContractualUf: "-1" }), ["cuotaContractualUf"]);
  assert.deepEqual(camposInvalidos({ ...valida, montoOriginalUf: "0" }), ["montoOriginalUf"]);
});

test("cero permitido en tasa, seguros y saldo inicial", () => {
  const d = creditoInputSchema.parse({
    ...valida,
    tasaInteresAnual: 0,
    segurosUf: 0,
    saldoInicialUf: "0.0000",
  });
  assert.equal(d.tasaInteresAnual, "0");
  assert.equal(d.segurosUf, "0");
  assert.equal(d.saldoInicialUf, "0.0000");
});

test("tasa, seguros y saldo negativos son inválidos", () => {
  assert.deepEqual(camposInvalidos({ ...valida, tasaInteresAnual: "-0.1" }), ["tasaInteresAnual"]);
  assert.deepEqual(camposInvalidos({ ...valida, segurosUf: "-1" }), ["segurosUf"]);
  assert.deepEqual(camposInvalidos({ ...valida, saldoInicialUf: "-1" }), ["saldoInicialUf"]);
});

test("número de cuotas debe ser entero positivo", () => {
  for (const v of [0, -1, 1.5, "12.5", "abc"]) {
    assert.deepEqual(camposInvalidos({ ...valida, numeroCuotasTotal: v }), ["numeroCuotasTotal"], String(v));
  }
});

test("día de vencimiento solo entre 1 y 31", () => {
  for (const v of [0, 32, -1, 1.5]) {
    assert.deepEqual(camposInvalidos({ ...valida, diaVencimiento: v }), ["diaVencimiento"], String(v));
  }
  assert.equal(creditoInputSchema.parse({ ...valida, diaVencimiento: 1 }).diaVencimiento, 1);
  assert.equal(creditoInputSchema.parse({ ...valida, diaVencimiento: "31" }).diaVencimiento, 31);
});

test("exceso de decimales o de rango", () => {
  assert.deepEqual(camposInvalidos({ ...valida, cuotaContractualUf: "1.12345" }), ["cuotaContractualUf"]);
  assert.deepEqual(camposInvalidos({ ...valida, cuotaContractualUf: "123456789" }), ["cuotaContractualUf"]);
  assert.deepEqual(camposInvalidos({ ...valida, tasaInteresAnual: "100" }), ["tasaInteresAnual"]);
  assert.deepEqual(camposInvalidos({ ...valida, tasaInteresAnual: "1.12345" }), ["tasaInteresAnual"]);
  assert.equal(creditoInputSchema.parse({ ...valida, tasaInteresAnual: "99.9999" }).tasaInteresAnual, "99.9999");
});

test("fecha de otorgamiento inexistente o con mal formato", () => {
  assert.deepEqual(camposInvalidos({ ...valida, fechaOtorgamiento: "2026-02-30" }), ["fechaOtorgamiento"]);
  assert.deepEqual(camposInvalidos({ ...valida, fechaOtorgamiento: "10/02/2026" }), ["fechaOtorgamiento"]);
});

test("sin reglas cruzadas: saldo inicial mayor que monto original es válido", () => {
  const d = creditoInputSchema.parse({ ...valida, montoOriginalUf: 100, saldoInicialUf: 500 });
  assert.equal(d.saldoInicialUf, "500");
});
