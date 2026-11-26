import { test } from "node:test";
import assert from "node:assert/strict";
import { vigenciaDe } from "../../server/domain/contrato-vigencia";

const contrato = { fechaInicio: "2026-03-10", fechaTermino: "2027-03-09" };

test("referencia anterior al inicio → FUTURO", () => {
  assert.equal(vigenciaDe(contrato, "2026-03-09"), "FUTURO");
});

test("extremos inclusivos → VIGENTE", () => {
  assert.equal(vigenciaDe(contrato, "2026-03-10"), "VIGENTE");
  assert.equal(vigenciaDe(contrato, "2026-09-01"), "VIGENTE");
  assert.equal(vigenciaDe(contrato, "2027-03-09"), "VIGENTE");
});

test("referencia posterior al término → FINALIZADO", () => {
  assert.equal(vigenciaDe(contrato, "2027-03-10"), "FINALIZADO");
});

test("contrato de un solo día", () => {
  const unDia = { fechaInicio: "2026-05-05", fechaTermino: "2026-05-05" };
  assert.equal(vigenciaDe(unDia, "2026-05-04"), "FUTURO");
  assert.equal(vigenciaDe(unDia, "2026-05-05"), "VIGENTE");
  assert.equal(vigenciaDe(unDia, "2026-05-06"), "FINALIZADO");
});
