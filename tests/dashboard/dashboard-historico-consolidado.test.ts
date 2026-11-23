import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { estadoConsolidado, mesAdyacente, mesesHasta } from "../../server/domain/dashboard";
import { sumarUf } from "../../server/domain/uf";
import { mesesHistorico } from "../../server/schemas/shared";
import { createDashboardService } from "../../server/services/dashboard-service";
import type { UfService, ValorUfDto } from "../../server/uf/uf-service";

// Histórico mensual y saldo consolidado (change dashboard-historico-mensual).
// Sin base de datos ni red: Prisma y la UF son dobles en memoria que aplican los
// mismos filtros de rango/elegibilidad que el servicio solicita.

const f = (s: string) => new Date(`${s}T00:00:00.000Z`);
type Rango = { gte?: Date; lt?: Date };
const enRango = (fecha: Date | null, r?: Rango) =>
  fecha !== null && (!r?.gte || fecha >= r.gte) && (!r?.lt || fecha < r.lt);

type Datos = {
  propiedades?: { id: string; numeroDepartamento: string }[];
  abonos?: { id: string; fechaRecepcion: Date; montoClp: string }[];
  dividendos?: { id: string; periodo: Date; fechaPagoDividendo: Date; dividendoPagadoClp: string; propiedadId: string }[];
  movimientos?: { id: string; propiedadId: string; fecha: Date; montoClp: string }[];
  saldos?: { creditoId: string; propiedadId: string; periodo: Date; saldoPendienteUf: string }[];
  creditos?: { propiedadId: string; fechaOtorgamiento: Date | null }[];
};

function fakePrisma(d: Datos) {
  const consultas = { total: 0 };
  const cuenta = <T>(v: T) => {
    consultas.total += 1;
    return Promise.resolve(v);
  };
  const prisma = {
    propiedad: { findMany: () => cuenta(d.propiedades ?? []) },
    abonoArriendo: {
      findMany: ({ where }: { where: { fechaRecepcion: Rango } }) =>
        cuenta(
          (d.abonos ?? [])
            .filter((a) => enRango(a.fechaRecepcion, where.fechaRecepcion))
            .map((a) => ({
              ...a,
              pagoEsperado: { periodo: a.fechaRecepcion, contrato: { id: "c", propiedadId: d.propiedades?.[0]?.id ?? "p" } },
            }))
        ),
    },
    creditoRegistroMensual: {
      findMany: ({ where }: { where: { fechaPagoDividendo?: Rango; periodo?: Rango } }) => {
        if (where.fechaPagoDividendo) {
          return cuenta(
            (d.dividendos ?? [])
              .filter((x) => enRango(x.fechaPagoDividendo, where.fechaPagoDividendo))
              .map((x) => ({ ...x, credito: { propiedadId: x.propiedadId } }))
          );
        }
        const vistos = new Set<string>();
        const filas = (d.saldos ?? [])
          .filter((s) => enRango(s.periodo, where.periodo))
          .sort((a, b) => b.periodo.getTime() - a.periodo.getTime())
          .filter((s) => (vistos.has(s.creditoId) ? false : (vistos.add(s.creditoId), true)))
          .map((s) => ({ ...s, credito: { propiedadId: s.propiedadId } }));
        return cuenta(filas);
      },
    },
    movimientoFinanciero: {
      findMany: ({ where }: { where: { fecha: Rango } }) =>
        cuenta(
          (d.movimientos ?? [])
            .filter((m) => enRango(m.fecha, where.fecha))
            .map((m) => ({ ...m, descripcion: null, categoria: "OTRO" }))
        ),
    },
    pagoEsperado: { findMany: () => cuenta([]) },
    creditoHipotecario: {
      findMany: ({ where }: { where: { OR: [unknown, { fechaOtorgamiento: { lt: Date } }] } }) => {
        const lt = where.OR[1].fechaOtorgamiento.lt;
        return cuenta((d.creditos ?? []).filter((c) => c.fechaOtorgamiento === null || c.fechaOtorgamiento < lt));
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, consultas };
}

function fakeUf(valores: Record<string, string>) {
  const llamadas: string[][] = [];
  const uf = {
    async obtenerValores(periodos: string[]) {
      llamadas.push(periodos);
      const m = new Map<string, ValorUfDto>();
      for (const p of periodos) {
        if (valores[p]) m.set(p, { periodo: p, valorClp: valores[p], fechaValor: `${p}-01`, fuente: "doble" });
      }
      return m;
    },
  } as unknown as UfService;
  return { uf, llamadas };
}

const P = [
  { id: "p1", numeroDepartamento: "101" },
  { id: "p2", numeroDepartamento: "102" },
  { id: "p3", numeroDepartamento: "103" },
];
const saldo = (propiedadId: string, periodo: string, uf: string) => ({
  creditoId: `cr-${propiedadId}`,
  propiedadId,
  periodo: f(`${periodo}-01`),
  saldoPendienteUf: uf,
});
const cred = (propiedadId: string, otorg: string | null = null) => ({
  propiedadId,
  fechaOtorgamiento: otorg ? f(otorg) : null,
});

// ---------- Dominio ----------

test("mesAdyacente cruza el año en ambos sentidos", () => {
  assert.equal(mesAdyacente("2026-01", -1), "2025-12");
  assert.equal(mesAdyacente("2026-12", 1), "2027-01");
  assert.equal(mesAdyacente("2026-06", 1), "2026-07");
  assert.equal(mesAdyacente("2026-06", -1), "2026-05");
});

test("mesesHasta devuelve n meses ascendentes que terminan en el mes dado", () => {
  assert.deepEqual(mesesHasta("2026-11", 6), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(mesesHasta("2026-02", 6), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(mesesHasta("2026-03", 12).length, 12);
  assert.equal(mesesHasta("2026-03", 12)[0], "2025-04");
  assert.deepEqual(mesesHasta("2026-03", 1), ["2026-03"]);
});

test("sumarUf es exacta y no usa coma flotante", () => {
  assert.equal(sumarUf(["100", "250.5", "50.25"]), "400.75");
  assert.equal(sumarUf(["0.1", "0.2"]), "0.3");
  assert.equal(sumarUf(["1234.5678", "0.0001"]), "1234.5679");
});

test("estadoConsolidado distingue completo, parcial y sin saldos", () => {
  assert.equal(estadoConsolidado(3, 3), "COMPLETO");
  assert.equal(estadoConsolidado(2, 3), "PARCIAL");
  assert.equal(estadoConsolidado(0, 3), "SIN_SALDOS");
  assert.equal(estadoConsolidado(0, 0), "SIN_SALDOS");
});

test("meses del histórico: entero entre 1 y 12", () => {
  for (const ok of ["1", "6", "12", 6]) assert.ok(mesesHistorico.safeParse(ok).success, String(ok));
  for (const mal of ["0", "13", "2.5", "abc", "-1", ""]) assert.ok(!mesesHistorico.safeParse(mal).success, mal);
});

// ---------- Histórico ----------

test("histórico de 6 meses con cruce de año, meses vacíos en cero y orden ascendente", async () => {
  const { prisma } = fakePrisma({
    propiedades: P,
    abonos: [{ id: "a1", fechaRecepcion: f("2025-12-10"), montoClp: "500000" }],
    movimientos: [{ id: "m1", propiedadId: "p1", fecha: f("2026-01-20"), montoClp: "150000" }],
    dividendos: [
      { id: "d1", periodo: f("2025-11-01"), fechaPagoDividendo: f("2025-12-05"), dividendoPagadoClp: "450000", propiedadId: "p1" },
    ],
  });
  const h = await createDashboardService(prisma).historico("2026-02", 6);
  assert.deepEqual(
    h.periodos.map((p) => p.mes),
    ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]
  );
  assert.equal(h.mes, "2026-02");
  assert.equal(h.meses, 6);
  const por = Object.fromEntries(h.periodos.map((p) => [p.mes, p]));
  assert.deepEqual(por["2025-10"], {
    mes: "2025-10",
    ingresosClp: "0",
    dividendosClp: "0",
    otrosEgresosClp: "0",
    egresosTotalesClp: "0",
    flujoNetoClp: "0",
  });
  // El dividendo del período noviembre pagado en diciembre cuenta en diciembre.
  assert.equal(por["2025-11"].dividendosClp, "0");
  assert.equal(por["2025-12"].dividendosClp, "450000");
  assert.equal(por["2025-12"].ingresosClp, "500000");
  assert.equal(por["2025-12"].flujoNetoClp, "50000");
  assert.equal(por["2026-01"].otrosEgresosClp, "150000"); // gasto (desglosado) contado una vez
  assert.equal(por["2026-01"].flujoNetoClp, "-150000");
});

test("el histórico hace tres consultas y nunca consulta la UF", async () => {
  const { prisma, consultas } = fakePrisma({ propiedades: P });
  await createDashboardService(prisma).historico("2026-02", 12);
  assert.equal(consultas.total, 3);
});

test("consistencia: cada mes del histórico coincide con el dashboard mensual", async () => {
  const { prisma } = fakePrisma({
    propiedades: P,
    abonos: [
      { id: "a1", fechaRecepcion: f("2025-12-31"), montoClp: "300000" },
      { id: "a2", fechaRecepcion: f("2026-01-01"), montoClp: "200000" },
    ],
    movimientos: [
      { id: "m1", propiedadId: "p2", fecha: f("2026-01-31"), montoClp: "90000" },
      { id: "m2", propiedadId: "p1", fecha: f("2026-02-01"), montoClp: "10000" },
    ],
    dividendos: [
      { id: "d1", periodo: f("2026-01-01"), fechaPagoDividendo: f("2026-01-05"), dividendoPagadoClp: "450000", propiedadId: "p1" },
      { id: "d2", periodo: f("2026-02-01"), fechaPagoDividendo: f("2026-03-02"), dividendoPagadoClp: "460000", propiedadId: "p2" },
    ],
  });
  const servicio = createDashboardService(prisma);
  const h = await servicio.historico("2026-03", 6);
  for (const p of h.periodos) {
    const { mes, ...totales } = p;
    assert.deepEqual(totales, (await servicio.resumenMensual(mes, "2026-06-15")).totales, mes);
  }
});

// ---------- Saldo consolidado ----------

test("consolida varios créditos con el último saldo aplicable de cada uno", async () => {
  const { prisma } = fakePrisma({
    propiedades: P,
    creditos: [cred("p1"), cred("p2"), cred("p3")],
    saldos: [
      saldo("p1", "2026-01", "100"),
      { ...saldo("p1", "2026-03", "90"), creditoId: "cr-p1" }, // posterior a febrero: no aplica
      saldo("p2", "2026-02", "250.5"),
      saldo("p3", "2025-12", "50.25"),
    ],
  });
  const { uf, llamadas } = fakeUf({ "2026-02": "40000.00" });
  const r = await createDashboardService(prisma, uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(r.saldoConsolidado.totalUf, "400.75");
  assert.equal(r.saldoConsolidado.estado, "COMPLETO");
  assert.deepEqual(r.saldoConsolidado.creditos, { total: 3, conSaldo: 3, sinSaldo: 0 });
  assert.equal(r.saldoConsolidado.equivalenteClp?.valorClp, "16030000");
  assert.equal(r.saldoConsolidado.equivalenteClp?.ufClp, "40000.00");
  assert.equal(r.saldoConsolidado.equivalenteClp?.fechaReferencia, "2026-02-01");
  assert.deepEqual(llamadas, [["2026-02"]]); // una sola consulta de UF por solicitud, la del mes consultado
});

test("un crédito sin saldo vuelve el consolidado parcial y no aporta cero", async () => {
  const { prisma } = fakePrisma({
    propiedades: P,
    creditos: [cred("p1"), cred("p2"), cred("p3")],
    saldos: [saldo("p1", "2026-01", "100"), saldo("p2", "2026-01", "200")],
  });
  const { uf } = fakeUf({ "2026-02": "40000" });
  const { saldoConsolidado: c } = await createDashboardService(prisma, uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(c.estado, "PARCIAL");
  assert.deepEqual(c.creditos, { total: 3, conSaldo: 2, sinSaldo: 1 });
  assert.equal(c.totalUf, "300");
});

test("sin ningún saldo: SIN_SALDOS, total y equivalente nulos, sin consultar la UF", async () => {
  const { prisma } = fakePrisma({ propiedades: P, creditos: [cred("p1")] });
  const { uf, llamadas } = fakeUf({ "2026-02": "40000" });
  const { saldoConsolidado: c } = await createDashboardService(prisma, uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(c.estado, "SIN_SALDOS");
  assert.equal(c.totalUf, null);
  assert.equal(c.equivalenteClp, null);
  assert.deepEqual(c.creditos, { total: 1, conSaldo: 0, sinSaldo: 1 });
  assert.deepEqual(llamadas, []);
});

test("cartera sin créditos: SIN_SALDOS con cero créditos", async () => {
  const { prisma } = fakePrisma({ propiedades: P });
  const { saldoConsolidado: c } = await createDashboardService(prisma).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(c.estado, "SIN_SALDOS");
  assert.deepEqual(c.creditos, { total: 0, conSaldo: 0, sinSaldo: 0 });
});

test("un crédito aún no otorgado en el mes consultado no cuenta como sin saldo", async () => {
  const { prisma } = fakePrisma({
    propiedades: P,
    creditos: [cred("p1"), cred("p2", "2026-05-10")],
    saldos: [saldo("p1", "2026-01", "100")],
  });
  const { saldoConsolidado: c } = await createDashboardService(prisma).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(c.estado, "COMPLETO");
  assert.deepEqual(c.creditos, { total: 1, conSaldo: 1, sinSaldo: 0 });
  // Otorgado dentro del mes consultado: ya forma parte del universo.
  const { prisma: p2 } = fakePrisma({
    propiedades: P,
    creditos: [cred("p1"), cred("p2", "2026-02-28")],
    saldos: [saldo("p1", "2026-01", "100")],
  });
  const r = await createDashboardService(p2).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(r.saldoConsolidado.estado, "PARCIAL");
});

test("UF del mes no disponible: equivalente null y el resto idéntico", async () => {
  const datos: Datos = {
    propiedades: P,
    creditos: [cred("p1")],
    saldos: [saldo("p1", "2026-01", "100")],
    abonos: [{ id: "a1", fechaRecepcion: f("2026-02-10"), montoClp: "500000" }],
  };
  const sin = await createDashboardService(fakePrisma(datos).prisma, fakeUf({}).uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  const con = await createDashboardService(fakePrisma(datos).prisma, fakeUf({ "2026-02": "40000" }).uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  assert.equal(sin.saldoConsolidado.totalUf, "100");
  assert.equal(sin.saldoConsolidado.equivalenteClp, null);
  assert.equal(con.saldoConsolidado.equivalenteClp?.valorClp, "4000000");
  assert.deepEqual(sin.totales, con.totales);
  assert.equal(sin.propiedades[0].saldoCredito?.equivalenteClp, null);
});

test("compatibilidad: los campos existentes no cambian y solo se añade saldoConsolidado", async () => {
  const datos: Datos = { propiedades: P, creditos: [cred("p1")], saldos: [saldo("p1", "2026-01", "100")] };
  const { uf } = fakeUf({ "2026-02": "40000" });
  const nuevo = await createDashboardService(fakePrisma(datos).prisma, uf).resumenMensualConEquivalentes("2026-02", "2026-06-15");
  const base = await createDashboardService(fakePrisma(datos).prisma).resumenMensual("2026-02", "2026-06-15");
  const { saldoConsolidado, ...resto } = nuevo;
  assert.ok(saldoConsolidado);
  assert.deepEqual(Object.keys(resto).sort(), ["mes", "propiedades", "totales"]);
  assert.deepEqual(resto.totales, base.totales);
  assert.deepEqual(
    resto.propiedades.map(({ saldoCredito, ...p }) => ({ ...p, saldo: saldoCredito && saldoCredito.saldoPendienteUf })),
    base.propiedades.map(({ saldoCredito, ...p }) => ({ ...p, saldo: saldoCredito && saldoCredito.saldoPendienteUf }))
  );
  assert.deepEqual(Object.keys(base).sort(), ["mes", "propiedades", "totales"]); // el DTO base no cambia
});
