import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaEsperada,
  montoVigenteEn,
  periodoDe,
  periodosEntre,
} from "../../server/domain/contrato-monto";
import { montoCrearSchema } from "../../server/schemas/contrato";

const filas = [
  { vigenteDesdePeriodo: "2026-09-01", montoMensualClp: "560000" },
  { vigenteDesdePeriodo: "2026-03-01", montoMensualClp: "500000" },
  { vigenteDesdePeriodo: "2026-06-01", montoMensualClp: "530000" },
];

test("montoVigenteEn: sin filas o antes de la primera es null", () => {
  assert.equal(montoVigenteEn([], "2026-05-01"), null);
  assert.equal(montoVigenteEn(filas, "2026-02-01"), null);
});

test("montoVigenteEn: rige la fila con mayor vigencia <= período, sin importar el orden", () => {
  assert.equal(montoVigenteEn(filas, "2026-03-01"), "500000");
  assert.equal(montoVigenteEn(filas, "2026-05-01"), "500000");
  assert.equal(montoVigenteEn(filas, "2026-06-01"), "530000");
  assert.equal(montoVigenteEn(filas, "2026-08-01"), "530000");
  assert.equal(montoVigenteEn(filas, "2026-09-01"), "560000");
  assert.equal(montoVigenteEn(filas, "2027-01-01"), "560000");
});

test("periodoDe normaliza al día 1", () => {
  assert.equal(periodoDe("2026-03-15"), "2026-03-01");
  assert.equal(periodoDe("2026-03"), "2026-03-01");
});

test("periodosEntre: inclusivo, cruza años y es vacío si desde > hasta", () => {
  assert.deepEqual(periodosEntre("2026-03-01", "2026-05-01"), [
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
  ]);
  assert.deepEqual(periodosEntre("2026-12-01", "2027-01-01"), ["2026-12-01", "2027-01-01"]);
  assert.deepEqual(periodosEntre("2026-03-01", "2026-03-01"), ["2026-03-01"]);
  assert.deepEqual(periodosEntre("2026-04-01", "2026-03-01"), []);
});

test("fechaEsperada: día normal, 31 en meses cortos y año bisiesto", () => {
  assert.equal(fechaEsperada("2026-03-01", 5), "2026-03-05");
  assert.equal(fechaEsperada("2026-03-01", 31), "2026-03-31");
  assert.equal(fechaEsperada("2026-02-01", 31), "2026-02-28");
  assert.equal(fechaEsperada("2028-02-01", 31), "2028-02-29");
  assert.equal(fechaEsperada("2026-04-01", 31), "2026-04-30");
});

test("montoCrearSchema: normaliza el período a día 1 y el motivo vacío a null", () => {
  const r = montoCrearSchema.parse({
    montoMensualClp: 530000,
    vigenteDesdePeriodo: "2026-06",
    motivo: "  ",
  });
  assert.equal(r.montoMensualClp, "530000");
  assert.equal(r.vigenteDesdePeriodo, "2026-06-01");
  assert.equal(r.motivo, null);
});

test("montoCrearSchema: rechaza montos y períodos inválidos", () => {
  const base = { montoMensualClp: "500000", vigenteDesdePeriodo: "2026-06" };
  for (const monto of ["0", "-1", "1.5", "abc", "", "123456789012345"]) {
    assert.equal(montoCrearSchema.safeParse({ ...base, montoMensualClp: monto }).success, false, monto);
  }
  for (const periodo of ["2026-13", "2026-00", "2026-6", "2026-06-01", "", undefined]) {
    assert.equal(
      montoCrearSchema.safeParse({ ...base, vigenteDesdePeriodo: periodo }).success,
      false,
      String(periodo)
    );
  }
});
