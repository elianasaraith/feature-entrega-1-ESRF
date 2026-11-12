import { test } from "node:test";
import assert from "node:assert/strict";
import { movimientoInputSchema } from "../../server/schemas/movimiento";

// Validación de formato (→ 400). Las reglas de negocio (monto > 0, fecha no
// futura) las aplica el servicio (→ 422) y se prueban en la integración.
const valido = { fecha: "2026-03-04", categoria: "REPARACION", montoClp: "150000" };

test("movimiento válido: descripción opcional y normalizada", () => {
  assert.deepEqual(movimientoInputSchema.parse({ ...valido, descripcion: "  Gasfitería " }), {
    ...valido,
    descripcion: "Gasfitería",
  });
  assert.equal(movimientoInputSchema.parse(valido).descripcion, null);
  assert.equal(movimientoInputSchema.parse({ ...valido, descripcion: "  " }).descripcion, null);
});

test("las 7 categorías pasan; DIVIDENDO y desconocidas se rechazan", () => {
  for (const categoria of [
    "REPARACION",
    "EQUIPAMIENTO",
    "SEGURO",
    "CONTRIBUCIONES",
    "GASTO_COMUN",
    "GASTO_EXTRAORDINARIO",
    "OTRO",
  ]) {
    assert.equal(movimientoInputSchema.parse({ ...valido, categoria }).categoria, categoria);
  }
  for (const categoria of ["DIVIDENDO", "reparacion", "", undefined]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, categoria }), `categoría ${categoria}`);
  }
});

test("el monto numérico se normaliza a texto; 0 y negativos pasan el formato", () => {
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: 450000 }).montoClp, "450000");
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: "0" }).montoClp, "0");
  assert.equal(movimientoInputSchema.parse({ ...valido, montoClp: "-5" }).montoClp, "-5");
});

test("monto con formato inválido o fuera de rango se rechaza", () => {
  for (const montoClp of ["abc", "1.5", "", "1e3", "12 000", "123456789012345"]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, montoClp }), `monto ${montoClp}`);
  }
});

test("fecha con formato o calendario inválido se rechaza", () => {
  for (const fecha of ["2026-02-30", "04-03-2026", "2026-3-4", "", undefined]) {
    assert.throws(() => movimientoInputSchema.parse({ ...valido, fecha }), `fecha ${fecha}`);
  }
});

test("un campo `tipo` se ignora: el resultado no lo contiene", () => {
  const r = movimientoInputSchema.parse({ ...valido, tipo: "INGRESO" });
  assert.equal("tipo" in r, false);
});
