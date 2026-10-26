import { test } from "node:test";
import assert from "node:assert/strict";
import { convertirUfAClp } from "../../server/domain/uf";

// Valores fijos solo para pruebas: no representan la UF real.
test("producto exacto con valor de UF fijo", () => {
  assert.equal(convertirUfAClp("10", "30000.50"), "300005");
  assert.equal(convertirUfAClp("12.3456", "30000.50"), "370374.1728");
});

test("decimales largos sin pérdida de precisión", () => {
  // 0.1 + 0.2 típico de float: aquí el producto es exacto.
  assert.equal(convertirUfAClp("0.1", "0.3"), "0.03");
  assert.equal(convertirUfAClp("99999999.9999", "99999999.99"), "9999999998990000.000001");
});

test("valor de UF ≤ 0 se rechaza", () => {
  assert.throws(() => convertirUfAClp("10", "0"), RangeError);
  assert.throws(() => convertirUfAClp("10", "-1"), RangeError);
});
