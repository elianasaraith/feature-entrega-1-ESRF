import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONCEPTOS,
  MAX_NOMBRE_CONCEPTO,
  esMontoEnteroTexto,
  sumarConceptos,
} from "../../server/domain/movimiento-desglose";

test("los límites del desglose son 50 conceptos y 100 caracteres por nombre", () => {
  assert.equal(MAX_CONCEPTOS, 50);
  assert.equal(MAX_NOMBRE_CONCEPTO, 100);
});

test("sumarConceptos: el ejemplo de 60.000 + 70.000 + 20.000 da 150.000", () => {
  assert.equal(sumarConceptos(["60000", "70000", "20000"]), "150000");
});

test("sumarConceptos: lista vacía → 0 y un solo concepto → su monto", () => {
  assert.equal(sumarConceptos([]), "0");
  assert.equal(sumarConceptos(["12345"]), "12345");
});

test("sumarConceptos: exacta por encima del rango seguro de float", () => {
  assert.equal(sumarConceptos(["99999999999999", "1"]), "100000000000000");
  assert.equal(sumarConceptos(["9007199254740993", "1"]), "9007199254740994");
});

test("sumarConceptos: normaliza ceros a la izquierda", () => {
  assert.equal(sumarConceptos(["0060", "040"]), "100");
});

test("sumarConceptos: un valor que no es entero en texto lanza error", () => {
  for (const malo of ["", "1.5", "-5", "abc", " 10", "1e3"]) {
    assert.throws(() => sumarConceptos(["10", malo]), `monto ${JSON.stringify(malo)}`);
  }
});

test("esMontoEnteroTexto: solo dígitos", () => {
  for (const ok of ["0", "7", "150000", "0042"]) assert.equal(esMontoEnteroTexto(ok), true, ok);
  for (const malo of ["", "-1", "1.5", "1,5", " 1", "1 ", "abc", "1e3"]) {
    assert.equal(esMontoEnteroTexto(malo), false, JSON.stringify(malo));
  }
});

test("el total en vivo ignora lo que aún no es un monto válido", () => {
  // Así lo compone la interfaz: filtrar con esMontoEnteroTexto y sumar.
  const escrito = ["60000", "", "70.5", "20000", "abc"];
  assert.equal(sumarConceptos(escrito.filter(esMontoEnteroTexto)), "80000");
});
