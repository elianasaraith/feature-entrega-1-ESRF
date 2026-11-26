import { test } from "node:test";
import assert from "node:assert/strict";
import { abonoInputSchema } from "../../server/schemas/abono";
import { UnprocessableError, NotFoundError, toHttpResponse } from "../../server/errors";

// Validación de formato (→ 400) y traducción de errores de negocio a HTTP
// (→ 404/422). Los Route Handlers solo componen requireSession + esquema +
// servicio + toHttpResponse; requireSession necesita el runtime de Next.js y no
// puede invocarse aislada (ver server/auth/require-session.ts).

const valido = { montoClp: "300000", fechaRecepcion: "2026-03-04" };

test("abono válido: monto entero, fecha real y medio opcional", () => {
  const r = abonoInputSchema.parse({ ...valido, medio: "  Transferencia " });
  assert.deepEqual(r, { montoClp: "300000", fechaRecepcion: "2026-03-04", medio: "Transferencia" });
  assert.equal(abonoInputSchema.parse(valido).medio, null);
  assert.equal(abonoInputSchema.parse({ ...valido, medio: "  " }).medio, null);
});

test("el monto numérico se normaliza a texto", () => {
  assert.equal(abonoInputSchema.parse({ ...valido, montoClp: 450000 }).montoClp, "450000");
});

test("cero y negativos pasan el formato: los rechaza el servicio con 422", () => {
  assert.equal(abonoInputSchema.parse({ ...valido, montoClp: "0" }).montoClp, "0");
  assert.equal(abonoInputSchema.parse({ ...valido, montoClp: "-5" }).montoClp, "-5");
});

test("formato inválido → error de validación", () => {
  for (const montoClp of ["abc", "1.5", "", "1e3", "12 000"]) {
    assert.equal(abonoInputSchema.safeParse({ ...valido, montoClp }).success, false, montoClp);
  }
  assert.equal(abonoInputSchema.safeParse({ ...valido, montoClp: "1".repeat(15) }).success, false);
  for (const fechaRecepcion of ["2026-02-30", "04-03-2026", "", "2026-3-4"]) {
    assert.equal(abonoInputSchema.safeParse({ ...valido, fechaRecepcion }).success, false, fechaRecepcion);
  }
  assert.equal(abonoInputSchema.safeParse({}).success, false);
  assert.equal(abonoInputSchema.safeParse(null).success, false);
});

test("el esquema no acepta mover el abono a otro pago", () => {
  const r = abonoInputSchema.parse({ ...valido, pagoEsperadoId: "otro" });
  assert.equal("pagoEsperadoId" in r, false);
});

test("errores a HTTP: formato 400, negocio 422, pertenencia 404", async () => {
  const zod = abonoInputSchema.safeParse({ montoClp: "x", fechaRecepcion: "y" });
  assert.equal(zod.success, false);
  if (zod.success) return;
  const r400 = toHttpResponse(zod.error);
  assert.equal(r400.status, 400);
  const cuerpo = (await r400.json()) as { campos: Record<string, string[]> };
  assert.ok(cuerpo.campos.montoClp && cuerpo.campos.fechaRecepcion);

  assert.equal(toHttpResponse(new UnprocessableError("x")).status, 422);
  assert.equal(toHttpResponse(new NotFoundError("x")).status, 404);
});
