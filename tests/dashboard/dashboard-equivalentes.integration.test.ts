import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";
import { createArrendatarioService } from "../../server/services/arrendatario-service";
import { createContratoService } from "../../server/services/contrato-service";
import { createCreditoRegistroService } from "../../server/services/credito-registro-service";
import { createCreditoService } from "../../server/services/credito-service";
import { createDashboardService } from "../../server/services/dashboard-service";
import { createMovimientoService } from "../../server/services/movimiento-service";
import { createPagoService } from "../../server/services/pago-service";
import { createPropiedadService } from "../../server/services/propiedad-service";
import { abonoInputSchema } from "../../server/schemas/abono";
import { arrendatarioInputSchema } from "../../server/schemas/arrendatario";
import { contratoCrearSchema } from "../../server/schemas/contrato";
import { creditoInputSchema } from "../../server/schemas/credito";
import { registroMensualCrearSchema } from "../../server/schemas/credito-registro";
import { movimientoInputSchema } from "../../server/schemas/movimiento";
import { propiedadInputSchema } from "../../server/schemas/propiedad";
import type { ProveedorUf, ResultadoUf } from "../../server/uf/proveedor";
import { createUfService } from "../../server/uf/uf-service";
import type { UfService } from "../../server/uf/uf-service";
import { resolveTestDatabase } from "../setup/test-db";

// T10 grupo 7: equivalentes en CLP del saldo del dashboard. PostgreSQL real solo
// con TEST_DATABASE_URL; UF desde un doble (sin red) y períodos de 1993, de modo
// que solo se borran esas filas de valor_uf_periodo y lo creado aquí.
const { url: testUrl, skip } = resolveTestDatabase();
const prisma = skip
  ? (null as unknown as PrismaClient)
  : new PrismaClient({ datasourceUrl: testUrl });
const propiedades = createPropiedadService(prisma);
const arrendatarios = createArrendatarioService(prisma);
const contratos = createContratoService(prisma);
const pagos = createPagoService(prisma);
const creditos = createCreditoService(prisma);
const registros = createCreditoRegistroService(prisma);
const movimientos = createMovimientoService(prisma);
const base = createDashboardService(prisma); // sin UF: referencia de los cálculos

const MES = "1993-03";
const HOY = "1993-06-15";
const FECHAS_UF = ["1993-02", "1993-03", "1993-04"].map((p) => new Date(`${p}-01T00:00:00.000Z`));
const propiedadesCreadas: string[] = [];
const arrendatariosCreados: string[] = [];
const silencio = () => {};

const ok = (fecha: string, valor: string): ResultadoUf => ({
  tipo: "ok",
  valorClp: new Prisma.Decimal(valor),
  fechaValor: fecha,
});
function doble(respuestas: Record<string, ResultadoUf | "lanza">) {
  const llamadas: string[] = [];
  const proveedor: ProveedorUf = {
    fuente: "doble-pruebas",
    async obtener(fecha) {
      llamadas.push(fecha);
      const r = respuestas[fecha];
      if (r === "lanza") throw new Error("proveedor caído");
      return r ?? { tipo: "sin-datos" };
    },
  };
  return { llamadas, uf: createUfService(prisma, proveedor, silencio) };
}
const conUf = (uf?: UfService) => createDashboardService(prisma, uf);

beforeEach(async () => {
  if (!skip) await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
});

after(async () => {
  if (skip) return;
  if (propiedadesCreadas.length) {
    const filas = await prisma.contratoArriendo.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true, arrendatarioId: true },
    });
    const idsContrato = filas.map((c) => c.id);
    if (idsContrato.length) {
      await prisma.abonoArriendo.deleteMany({ where: { pagoEsperado: { contratoId: { in: idsContrato } } } });
      await prisma.pagoEsperado.deleteMany({ where: { contratoId: { in: idsContrato } } });
      await prisma.contratoMonto.deleteMany({ where: { contratoId: { in: idsContrato } } });
      await prisma.contratoArriendo.deleteMany({ where: { id: { in: idsContrato } } });
    }
    arrendatariosCreados.push(...filas.map((c) => c.arrendatarioId));
    const cr = await prisma.creditoHipotecario.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    if (cr.length) {
      await prisma.creditoRegistroMensual.deleteMany({ where: { creditoId: { in: cr.map((c) => c.id) } } });
    }
    await prisma.creditoHipotecario.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    const movs = await prisma.movimientoFinanciero.findMany({
      where: { propiedadId: { in: propiedadesCreadas } },
      select: { id: true },
    });
    if (movs.length) {
      await prisma.movimientoConcepto.deleteMany({ where: { movimientoFinancieroId: { in: movs.map((m) => m.id) } } });
    }
    await prisma.movimientoFinanciero.deleteMany({ where: { propiedadId: { in: propiedadesCreadas } } });
    await prisma.propiedad.deleteMany({ where: { id: { in: propiedadesCreadas } } });
  }
  if (arrendatariosCreados.length) {
    await prisma.arrendatario.deleteMany({ where: { id: { in: arrendatariosCreados } } });
  }
  await prisma.valorUfPeriodo.deleteMany({ where: { periodo: { in: FECHAS_UF } } });
  await prisma.$disconnect();
});

let contador = 0;
async function nuevaPropiedad(saldos: { periodo: string; saldoUf: string }[] = []) {
  contador += 1;
  const p = await propiedades.crear(
    propiedadInputSchema.parse({
      numeroDepartamento: `TEST-DUF-${contador}`,
      superficieM2: 40,
      valorCompraMonto: 2000,
      valorCompraMoneda: "UF",
      fechaCompra: "1990-05-10",
    })
  );
  propiedadesCreadas.push(p.id);
  if (saldos.length) {
    await creditos.crear(
      p.id,
      creditoInputSchema.parse({
        banco: "Banco Ficticio",
        cuotaContractualUf: "12.3456",
        tasaInteresAnual: "4.1250",
        numeroCuotasTotal: 240,
        diaVencimiento: 5,
      })
    );
    for (const s of saldos) {
      await registros.crear(p.id, registroMensualCrearSchema.parse({ periodo: s.periodo, saldoPendienteUf: s.saldoUf }));
    }
  }
  return p.id;
}

// Propiedad con ingreso, dividendo, gasto DESGLOSADO y saldo: datos de T07 y T09.
async function propiedadCompleta() {
  const id = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  await registros.crear(
    id,
    registroMensualCrearSchema.parse({ periodo: MES, dividendoPagadoClp: "450000", fechaPagoDividendo: "1993-03-05" })
  );
  const arr = await arrendatarios.crear(arrendatarioInputSchema.parse({ nombre: "Arrendatario Ficticio" }));
  arrendatariosCreados.push(arr.id);
  const c = await contratos.crear(
    id,
    contratoCrearSchema.parse({
      fechaInicio: "1993-01-01",
      fechaTermino: "1993-12-31",
      diaEsperadoPago: 5,
      arrendatarioId: arr.id,
      montoMensualClp: "600000",
    }),
    HOY
  );
  await contratos.sincronizarPagos(id, c.id, HOY);
  const pago = (await pagos.listarPagos(id, c.id, HOY)).find((x) => x.periodo === "1993-03-01");
  assert.ok(pago);
  await pagos.crearAbono(
    id,
    c.id,
    pago.id,
    abonoInputSchema.parse({ montoClp: "500000", fechaRecepcion: "1993-03-04" }),
    HOY
  );
  await movimientos.crear(
    id,
    movimientoInputSchema.parse({
      fecha: "1993-03-10",
      categoria: "REPARACION",
      conceptos: [
        { nombre: "Materiales", montoClp: "60000" },
        { nombre: "Mano de obra", montoClp: "70000" },
        { nombre: "Transporte", montoClp: "20000" },
      ],
    }),
    HOY
  );
  return id;
}

// Quita solo el campo nuevo para comparar todo lo demás con estricta igualdad.
type ConSaldo = { saldoCredito: ({ equivalenteClp?: unknown } & Record<string, unknown>) | null };
const sinEquivalente = <T extends object>(r: T & ConSaldo | T & { saldoCredito: unknown }) => {
  const { saldoCredito, ...resto } = r as ConSaldo & Record<string, unknown>;
  if (!saldoCredito) return { ...resto, saldoCredito: null };
  const copia = { ...saldoCredito };
  delete copia.equivalenteClp;
  return { ...resto, saldoCredito: copia };
};

test("saldo de un período anterior se convierte con la UF del mes consultado y conserva su período", { skip }, async () => {
  const { llamadas, uf } = doble({ "1993-03-01": ok("1993-03-01", "2000.00"), "1993-01-01": ok("1993-01-01", "9999.00") });
  const id = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  const r = await conUf(uf).resumenPropiedadConEquivalentes(id, MES, HOY);
  assert.deepEqual(r.saldoCredito, {
    periodo: "1993-01", // período original del saldo
    saldoPendienteUf: "100",
    equivalenteClp: { valorClp: "200000", ufClp: "2000.00", fechaReferencia: "1993-03-01" },
  });
  assert.deepEqual(llamadas, ["1993-03-01"]); // nunca la UF del período del saldo
});

test("varias propiedades comparten una única referencia y una única consulta de UF", { skip }, async () => {
  const { llamadas, uf } = doble({ "1993-03-01": ok("1993-03-01", "2000.00") });
  const a = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  const b = await nuevaPropiedad([{ periodo: "1993-02", saldoUf: "50.5" }]);
  const sin = await nuevaPropiedad();
  const r = await conUf(uf).resumenMensualConEquivalentes(MES, HOY);
  const fila = (id: string) => r.propiedades.find((p) => p.propiedadId === id);
  assert.equal(fila(a)?.saldoCredito?.equivalenteClp?.valorClp, "200000");
  assert.equal(fila(b)?.saldoCredito?.equivalenteClp?.valorClp, "101000");
  assert.equal(fila(a)?.saldoCredito?.equivalenteClp?.fechaReferencia, "1993-03-01");
  assert.equal(fila(b)?.saldoCredito?.equivalenteClp?.fechaReferencia, "1993-03-01");
  assert.equal(fila(sin)?.saldoCredito, null);
  assert.deepEqual(llamadas, ["1993-03-01"]);
});

test("mes sin saldo: saldoCredito null y no se consulta la UF", { skip }, async () => {
  const { llamadas, uf } = doble({ "1993-03-01": ok("1993-03-01", "2000.00") });
  const id = await nuevaPropiedad([{ periodo: "1993-05", saldoUf: "100" }]); // saldo posterior al mes
  const r = await conUf(uf).resumenPropiedadConEquivalentes(id, MES, HOY);
  assert.equal(r.saldoCredito, null);
  assert.deepEqual(llamadas, []);
});

test("UF no disponible, sin datos o proveedor caído: equivalente null y saldo en UF intacto", { skip }, async () => {
  const roto = {
    obtenerValores: async () => {
      throw new Error("tabla no disponible");
    },
  } as unknown as UfService;
  const id = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  const casos: UfService[] = [
    doble({}).uf,
    doble({ "1993-03-01": { tipo: "error", motivo: "HTTP 500" } }).uf,
    doble({ "1993-03-01": "lanza" }).uf,
    roto,
  ];
  const original = console.error;
  console.error = silencio;
  try {
    for (const uf of casos) {
      const r = await conUf(uf).resumenPropiedadConEquivalentes(id, MES, HOY);
      assert.deepEqual(r.saldoCredito, { periodo: "1993-01", saldoPendienteUf: "100", equivalenteClp: null });
    }
  } finally {
    console.error = original;
  }
  assert.equal(await prisma.valorUfPeriodo.count({ where: { periodo: { in: FECHAS_UF } } }), 0);
});

test("UF previamente almacenada e histórico estable: la UF «actual» cambia y las cifras no", { skip }, async () => {
  const id = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  const primera = doble({ "1993-03-01": ok("1993-03-01", "2000.00") });
  const antes = await conUf(primera.uf).resumenPropiedadConEquivalentes(id, MES, HOY);
  const segunda = doble({ "1993-03-01": ok("1993-03-01", "9999.00") });
  const despues = await conUf(segunda.uf).resumenPropiedadConEquivalentes(id, MES, HOY);
  assert.deepEqual(segunda.llamadas, []);
  assert.deepEqual(despues, antes);
  assert.equal(despues.saldoCredito?.equivalenteClp?.ufClp, "2000.00");
});

test("totales, flujo neto, pagos y actividad idénticos con UF, sin UF y con proveedor caído; el desglosado cuenta una vez", { skip }, async () => {
  const id = await propiedadCompleta();
  const referencia = await base.resumenPropiedad(id, MES, HOY);
  // Cifras exactas de T07/T09: el gasto desglosado (60k+70k+20k) cuenta UNA vez.
  assert.equal(referencia.ingresosClp, "500000");
  assert.equal(referencia.dividendosClp, "450000");
  assert.equal(referencia.otrosEgresosClp, "150000");
  assert.equal(referencia.egresosTotalesClp, "600000");
  assert.equal(referencia.flujoNetoClp, "-100000");

  const original = console.error;
  console.error = silencio;
  try {
    for (const uf of [
      doble({ "1993-03-01": ok("1993-03-01", "2000.00") }).uf,
      doble({}).uf,
      doble({ "1993-03-01": "lanza" }).uf,
      undefined,
    ]) {
      const r = await conUf(uf).resumenPropiedadConEquivalentes(id, MES, HOY);
      assert.deepEqual(sinEquivalente(r), sinEquivalente(referencia)); // todo igual salvo el campo nuevo
    }
  } finally {
    console.error = original;
  }
  // El equivalente es informativo: con UF presente no altera ningún total.
  const conUfOk = await conUf(doble({ "1993-03-01": ok("1993-03-01", "2000.00") }).uf).resumenMensualConEquivalentes(MES, HOY);
  const fila = conUfOk.propiedades.find((p) => p.propiedadId === id);
  assert.equal(fila?.flujoNetoClp, "-100000");
  assert.equal(fila?.saldoCredito?.equivalenteClp?.valorClp, "200000");
});

test("compatibilidad: sin servicio de UF el DTO añade solo equivalenteClp: null; los métodos originales no consultan UF", { skip }, async () => {
  const id = await nuevaPropiedad([{ periodo: "1993-01", saldoUf: "100" }]);
  const sinUf = await conUf(undefined).resumenPropiedadConEquivalentes(id, MES, HOY);
  const original = await base.resumenPropiedad(id, MES, HOY);
  assert.equal(sinUf.saldoCredito?.equivalenteClp, null);
  assert.deepEqual(sinEquivalente(sinUf), sinEquivalente(original));
  assert.deepEqual(original.saldoCredito, { periodo: "1993-01", saldoPendienteUf: "100" }); // contrato anterior

  // Consumidores que no necesitan UF: aunque el servicio tenga UF inyectada,
  // resumenPropiedad y resumenMensual nunca llaman al proveedor.
  const { llamadas, uf } = doble({ "1993-03-01": ok("1993-03-01", "2000.00") });
  const servicio = conUf(uf);
  assert.deepEqual((await servicio.resumenPropiedad(id, MES, HOY)).saldoCredito, original.saldoCredito);
  await servicio.resumenMensual(MES, HOY);
  assert.deepEqual(llamadas, []);
});
