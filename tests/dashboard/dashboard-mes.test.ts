import { test } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { toHttpResponse } from "../../server/errors";
import { yearMonth } from "../../server/schemas/shared";

// Los endpoints validan `mes` con yearMonth y traducen el ZodError con
// toHttpResponse: un mes inválido responde 400, uno válido (incluso futuro) pasa.
test("mes inválido → 400; mes válido, pasado o futuro, se acepta", async () => {
  for (const malo of ["2026-13", "2026-00", "2026-3", "26-03", "marzo", "2026-03-01", ""]) {
    const resultado = yearMonth.safeParse(malo);
    assert.equal(resultado.success, false, malo);
    if (!resultado.success) {
      const respuesta = toHttpResponse(new ZodError(resultado.error.issues));
      assert.equal(respuesta.status, 400, malo);
    }
  }
  for (const bueno of ["2026-03", "2019-12", "2031-01"]) {
    assert.equal(yearMonth.parse(bueno), bueno);
  }
});
