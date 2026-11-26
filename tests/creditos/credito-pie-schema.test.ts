import { test } from "node:test";
import assert from "node:assert/strict";
import { creditoInputSchema } from "../../server/schemas/credito";

// change porcentaje-pie-hipotecario: validación de `porcentajePie` (0..100, máx. 2
// decimales, opcional). null ≠ 0.
const valida = {
  banco: "Banco Ficticio",
  cuotaContractualUf: "12.3456",
  tasaInteresAnual: "4.1250",
  numeroCuotasTotal: 240,
  diaVencimiento: 5,
};

const pie = (v: unknown) => creditoInputSchema.parse({ ...valida, porcentajePie: v }).porcentajePie;

function invalido(v: unknown): boolean {
  const r = creditoInputSchema.safeParse({ ...valida, porcentajePie: v });
  if (r.success) return false;
  assert.deepEqual(r.error.issues.map((i) => i.path.join(".")), ["porcentajePie"]);
  return true;
}

test("porcentaje válido, como número o texto, sin pérdida de precisión", () => {
  assert.equal(pie("20"), "20");
  assert.equal(pie(20), "20");
  assert.equal(pie("20.5"), "20.5");
  assert.equal(pie(" 33.33 "), "33.33");
});

test("límites 0 y 100 inclusive; 0 se conserva como 0, no como null", () => {
  for (const v of [0, "0", "0.00", "0.0"]) {
    assert.notEqual(pie(v), null, String(v));
    assert.equal(Number(pie(v)), 0);
  }
  assert.equal(pie("0"), "0");
  for (const v of [100, "100", "100.0", "100.00"]) assert.equal(Number(pie(v)), 100, String(v));
});

test("decimales: hasta dos", () => {
  assert.equal(pie("0.01"), "0.01");
  assert.equal(pie("99.99"), "99.99");
  assert.equal(invalido("12.345"), true);
  assert.equal(invalido("0.001"), true);
});

test("fuera de rango o con formato inválido", () => {
  for (const v of ["100.01", 100.01, "101", 101, "1000", "-0.01", -1, "-5", "abc", "1e2", "20%", "1,5"]) {
    assert.equal(invalido(v), true, String(v));
  }
});

test("omitido, null y vacío → null", () => {
  assert.equal(creditoInputSchema.parse(valida).porcentajePie, null);
  assert.equal(pie(null), null);
  assert.equal(pie(undefined), null);
  assert.equal(pie(""), null);
});

test("créditos existentes: el cuerpo previo (sin el campo) sigue siendo válido", () => {
  const d = creditoInputSchema.parse({
    ...valida,
    numeroCredito: "X-1",
    montoOriginalUf: 1800,
    saldoInicialUf: "1799.9999",
  });
  assert.equal(d.cuotaContractualUf, "12.3456");
  assert.equal(d.montoOriginalUf, "1800");
  assert.equal(d.porcentajePie, null);
});
