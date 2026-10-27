import { test } from "node:test";
import assert from "node:assert/strict";
import {
  periodoSchema,
  registroMensualActualizarSchema as actualizar,
  registroMensualCrearSchema as crear,
} from "../../server/schemas/credito-registro";

// Sin BD: solo validación de entrada.

function campos(resultado: ReturnType<typeof crear.safeParse>): string[] {
  return resultado.success ? [] : resultado.error.issues.map((i) => i.path.join("."));
}

const completo = {
  periodo: "2026-03",
  dividendoPagadoClp: "412345",
  fechaPagoDividendo: "2026-04-03",
  saldoPendienteUf: "1799.9999",
};

test("alta con dividendo, fecha y saldo; precisión preservada como texto", () => {
  const r = crear.parse(completo);
  assert.equal(r.dividendoPagadoClp, "412345");
  assert.equal(r.saldoPendienteUf, "1799.9999");
  assert.equal(r.fechaPagoDividendo, "2026-04-03");
});

test("alta solo con saldo: dividendo y fecha en null", () => {
  const r = crear.parse({ periodo: "2026-03", saldoPendienteUf: "10" });
  assert.equal(r.dividendoPagadoClp, null);
  assert.equal(r.fechaPagoDividendo, null);
});

test("alta solo con dividendo y fecha", () => {
  const r = crear.parse({
    periodo: "2026-03",
    dividendoPagadoClp: 412345,
    fechaPagoDividendo: "2026-03-05",
  });
  assert.equal(r.dividendoPagadoClp, "412345");
  assert.equal(r.saldoPendienteUf, null);
});

test("cadenas vacías del formulario equivalen a null", () => {
  const r = crear.parse({
    periodo: "2026-03",
    dividendoPagadoClp: "",
    fechaPagoDividendo: "",
    saldoPendienteUf: "5",
  });
  assert.equal(r.dividendoPagadoClp, null);
  assert.equal(r.fechaPagoDividendo, null);
});

test("fila sin saldo ni dividendo se rechaza", () => {
  assert.ok(campos(crear.safeParse({ periodo: "2026-03" })).includes("saldoPendienteUf"));
  assert.equal(actualizar.safeParse({}).success, false);
});

test("dividendo sin fecha de pago se rechaza en fechaPagoDividendo", () => {
  const r = crear.safeParse({ periodo: "2026-03", dividendoPagadoClp: "1000" });
  assert.deepEqual(campos(r), ["fechaPagoDividendo"]);
});

test("fecha de pago sin dividendo se rechaza", () => {
  const r = crear.safeParse({
    periodo: "2026-03",
    saldoPendienteUf: "5",
    fechaPagoDividendo: "2026-03-05",
  });
  assert.deepEqual(campos(r), ["fechaPagoDividendo"]);
});

test("dividendo 0, negativo o con decimales se rechaza", () => {
  for (const dividendoPagadoClp of ["0", "-5", "100.5", "abc", "1e5"]) {
    const r = crear.safeParse({ ...completo, dividendoPagadoClp });
    assert.ok(campos(r).includes("dividendoPagadoClp"), dividendoPagadoClp);
  }
});

test("dividendo fuera del rango NUMERIC(14,0) se rechaza", () => {
  assert.equal(crear.safeParse({ ...completo, dividendoPagadoClp: "1".repeat(15) }).success, false);
  assert.equal(crear.safeParse({ ...completo, dividendoPagadoClp: "1".repeat(14) }).success, true);
});

test("saldo negativo, con 5 decimales o fuera de rango se rechaza; 0 se acepta", () => {
  for (const saldoPendienteUf of ["-1", "1.12345", "123456789"]) {
    const r = crear.safeParse({ ...completo, saldoPendienteUf });
    assert.ok(campos(r).includes("saldoPendienteUf"), saldoPendienteUf);
  }
  assert.equal(crear.parse({ ...completo, saldoPendienteUf: "0" }).saldoPendienteUf, "0");
});

test("fecha de pago inexistente o mal formada se rechaza", () => {
  for (const fechaPagoDividendo of ["2026-02-30", "03/04/2026", "2026-4-3"]) {
    const r = crear.safeParse({ ...completo, fechaPagoDividendo });
    assert.ok(campos(r).includes("fechaPagoDividendo"), fechaPagoDividendo);
  }
});

test("período YYYY-MM válido; mes 13, 00 o mal formado se rechaza", () => {
  assert.equal(periodoSchema.safeParse("2026-12").success, true);
  for (const p of ["2026-13", "2026-00", "2026-3", "2026-03-01", "26-03", ""]) {
    assert.equal(periodoSchema.safeParse(p).success, false, p);
  }
  assert.ok(campos(crear.safeParse({ ...completo, periodo: "2026-13" })).includes("periodo"));
});

test("períodos futuros y fecha de pago anterior al período se aceptan", () => {
  assert.equal(crear.safeParse({ ...completo, periodo: "2099-01" }).success, true);
  assert.equal(
    crear.safeParse({ ...completo, periodo: "2026-03", fechaPagoDividendo: "2020-01-01" }).success,
    true
  );
});

test("actualizar ignora un periodo en el cuerpo (el período no se modifica)", () => {
  const r = actualizar.parse({ ...completo });
  assert.equal("periodo" in r, false);
});
