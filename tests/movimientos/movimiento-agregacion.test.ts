import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS_MOVIMIENTO,
  agregarPorCategoria,
  rangoDelMes,
} from "../../server/domain/movimiento-agregacion";

test("el conjunto de categorías son las 7 del modelo, sin DIVIDENDO", () => {
  assert.equal(CATEGORIAS_MOVIMIENTO.length, 7);
  assert.equal((CATEGORIAS_MOVIMIENTO as readonly string[]).includes("DIVIDENDO"), false);
});

test("lista vacía: total 0 y las 7 categorías en 0", () => {
  const r = agregarPorCategoria([]);
  assert.equal(r.totalClp, "0");
  assert.deepEqual(Object.keys(r.porCategoria).sort(), [...CATEGORIAS_MOVIMIENTO].sort());
  for (const c of CATEGORIAS_MOVIMIENTO) assert.equal(r.porCategoria[c], "0");
});

test("desglose: cada subtotal suma solo su categoría y el total suma todo", () => {
  const r = agregarPorCategoria([
    { categoria: "REPARACION", montoClp: "100000" },
    { categoria: "REPARACION", montoClp: "50000" },
    { categoria: "SEGURO", montoClp: "30000" },
    { categoria: "GASTO_COMUN", montoClp: "45000" },
  ]);
  assert.equal(r.porCategoria.REPARACION, "150000");
  assert.equal(r.porCategoria.SEGURO, "30000");
  assert.equal(r.porCategoria.GASTO_COMUN, "45000");
  assert.equal(r.porCategoria.OTRO, "0");
  assert.equal(r.totalClp, "225000");
});

test("suma exacta por encima del rango seguro de float", () => {
  const r = agregarPorCategoria([
    { categoria: "OTRO", montoClp: "99999999999999" },
    { categoria: "OTRO", montoClp: "99999999999999" },
    { categoria: "SEGURO", montoClp: "1" },
  ]);
  assert.equal(r.porCategoria.OTRO, "199999999999998");
  assert.equal(r.totalClp, "199999999999999");
});

test("rangoDelMes: límite inclusivo y exclusivo", () => {
  assert.deepEqual(rangoDelMes("2026-03"), { desde: "2026-03-01", hasta: "2026-04-01" });
  assert.deepEqual(rangoDelMes("2026-12"), { desde: "2026-12-01", hasta: "2027-01-01" });
  assert.deepEqual(rangoDelMes("2024-02"), { desde: "2024-02-01", hasta: "2024-03-01" });
});
