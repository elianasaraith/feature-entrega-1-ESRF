import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaReferenciaPeriodo } from "../../server/uf/uf-service";

test("el período se refiere al día 1 del mes", () => {
  assert.equal(fechaReferenciaPeriodo("2026-03"), "2026-03-01");
  assert.equal(fechaReferenciaPeriodo("2026-12"), "2026-12-01");
});

test("período con formato inválido", () => {
  for (const p of ["2026-3", "2026-13", "2026-00", "2026-03-01", ""]) {
    assert.throws(() => fechaReferenciaPeriodo(p), RangeError, p);
  }
});
