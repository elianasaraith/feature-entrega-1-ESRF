import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { CategoriaMovimiento } from "@prisma/client";
import * as argon2 from "argon2";

// Seed de DEMOSTRACIÓN (entrega final). Datos exclusivamente ficticios.
// Se ejecuta SOLO con `npm run db:seed:demo` (carga `.env.production.local`).
//
// - Repetible: todos los registros tienen un id determinista (UUID derivado de una
//   clave) y se escriben con upsert; volver a ejecutarlo no duplica nada.
// - Fechas relativas a hoy (Chile): 6 meses de histórico + el mes actual.
// - Protección: no corre si no se confirma explícitamente el host de destino, si el
//   destino es local, o si la base ya contiene propiedades que no son de la demo.
// - No siembra la UF: los valores se obtienen bajo demanda desde la API pública.

// ───────────────────────── Protección ─────────────────────────

function sinPooler(host: string): string {
  return host.toLowerCase().replace("-pooler", "");
}

function exigirDestinoDemo(): string {
  const url = process.env.DATABASE_URL;
  const hostConfirmado = process.env.DEMO_SEED_TARGET_HOST;

  if (!url) {
    throw new Error(
      "DATABASE_URL no está definida. Usa `npm run db:seed:demo` (carga .env.production.local)."
    );
  }
  if (!hostConfirmado) {
    throw new Error(
      "Falta DEMO_SEED_TARGET_HOST: debe ser el host de DATABASE_URL del entorno de demo."
    );
  }

  const host = new URL(url).hostname;
  const esLocal =
    host === "localhost" || host.startsWith("127.") || host === "::1" || !host.includes(".");
  if (esLocal) {
    throw new Error(`Destino local rechazado (${host}): el seed de demo no corre en local.`);
  }
  if (sinPooler(host) !== sinPooler(hostConfirmado)) {
    throw new Error(
      `DEMO_SEED_TARGET_HOST (${hostConfirmado}) no coincide con el host de DATABASE_URL (${host}).`
    );
  }
  return url;
}

// ───────────────────────── Helpers ─────────────────────────

// UUID determinista (formato v5) a partir de una clave: base del upsert repetible.
function uid(...partes: string[]): string {
  const h = createHash("sha1").update(`realtytrack-demo:${partes.join(":")}`).digest("hex");
  const variante = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

const aFecha = (f: string) => new Date(`${f}T00:00:00.000Z`);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }); // YYYY-MM-DD
const mesActual = hoy.slice(0, 7);

function addMes(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
const dia = (ym: string, d: number) => `${ym}-${String(d).padStart(2, "0")}`;
const unaVez = <T>(v: T) => ({ create: v, update: v });

// k = meses hacia atrás desde el mes actual (5 … 0).
const OFFSETS = [5, 4, 3, 2, 1, 0];

// ───────────────────────── Datos ficticios ─────────────────────────

type Demo = {
  clave: string;
  numeroDepartamento: string;
  direccion: string;
  superficieM2: number;
  valorCompraMonto: number;
  valorCompraMoneda: "UF" | "CLP";
  fechaCompra: string;
  estacionamiento: string | null;
  bodega: string | null;
  credito: null | {
    banco: string;
    numeroCredito: string;
    fechaOtorgamiento: string;
    montoOriginalUf: number;
    cuotaContractualUf: number;
    tasaInteresAnual: number;
    numeroCuotasTotal: number;
    segurosUf: number;
    diaVencimiento: number;
    porcentajePie: number;
    saldoUfHace5Meses: number; // saldo en el primer mes del histórico
    amortizacionUfMes: number;
    dividendoBaseClp: number;
  };
  arrendatario: { nombre: string; email: string };
  montoMensualClp: number;
  reajuste: { desdeK: number; montoClp: number } | null;
  diaPago: number;
};

const DEMOS: Demo[] = [
  {
    clave: "p1",
    numeroDepartamento: "101-A",
    direccion: "Calle Ficticia 123, Depto 101-A",
    superficieM2: 48.5,
    valorCompraMonto: 2200,
    valorCompraMoneda: "UF",
    fechaCompra: "2021-03-15",
    estacionamiento: "E-12",
    bodega: "B-5",
    credito: {
      banco: "Banco Demo Uno",
      numeroCredito: "DEMO-0001",
      fechaOtorgamiento: "2021-03-10",
      montoOriginalUf: 1760,
      cuotaContractualUf: 8.2,
      tasaInteresAnual: 4.2,
      numeroCuotasTotal: 300,
      segurosUf: 0.35,
      diaVencimiento: 5,
      porcentajePie: 20,
      saldoUfHace5Meses: 1642.5,
      amortizacionUfMes: 2.4,
      dividendoBaseClp: 332000,
    },
    arrendatario: { nombre: "Ana Ejemplo Prueba", email: "ana.ejemplo@example.com" },
    montoMensualClp: 450000,
    reajuste: { desdeK: 2, montoClp: 480000 },
    diaPago: 5,
  },
  {
    clave: "p2",
    numeroDepartamento: "205-B",
    direccion: "Avenida de Prueba 456, Depto 205-B",
    superficieM2: 62.0,
    valorCompraMonto: 3100,
    valorCompraMoneda: "UF",
    fechaCompra: "2022-07-01",
    estacionamiento: null,
    bodega: "B-9",
    credito: {
      banco: "Banco Demo Dos",
      numeroCredito: "DEMO-0002",
      fechaOtorgamiento: "2022-06-25",
      montoOriginalUf: 2790,
      cuotaContractualUf: 12.9,
      tasaInteresAnual: 4.5,
      numeroCuotasTotal: 360,
      segurosUf: 0.5,
      diaVencimiento: 10,
      porcentajePie: 10,
      saldoUfHace5Meses: 2701.3,
      amortizacionUfMes: 3.1,
      dividendoBaseClp: 505000,
    },
    arrendatario: { nombre: "Bruno Muestra Demo", email: "bruno.muestra@example.com" },
    montoMensualClp: 520000,
    reajuste: null,
    diaPago: 28,
  },
  {
    clave: "p3",
    numeroDepartamento: "310-C",
    direccion: "Pasaje Imaginario 789, Depto 310-C",
    superficieM2: 35.2,
    valorCompraMonto: 95000000,
    valorCompraMoneda: "CLP",
    fechaCompra: "2023-11-20",
    estacionamiento: null,
    bodega: null,
    credito: null, // compra al contado: sin crédito
    arrendatario: { nombre: "Carla Ficticia Demo", email: "carla.ficticia@example.com" },
    montoMensualClp: 380000,
    reajuste: null,
    diaPago: 28,
  },
];

type Concepto = { nombre: string; montoClp: number };
type MovimientoDemo = {
  clave: string;
  k: number;
  dia: number;
  categoria: CategoriaMovimiento;
  descripcion: string;
  montoClp?: number; // gasto simple
  conceptos?: Concepto[]; // gasto desglosado: el monto es la suma
};

const MOVIMIENTOS: Record<string, MovimientoDemo[]> = {
  p1: [
    { clave: "seguro", k: 5, dia: 12, categoria: "SEGURO", descripcion: "Seguro de incendio anual (demo)", montoClp: 45000 },
    {
      clave: "gasfiter", k: 3, dia: 14, categoria: "REPARACION", descripcion: "Reparación de cañería (demo)",
      conceptos: [{ nombre: "Mano de obra gásfiter", montoClp: 70000 }, { nombre: "Materiales", montoClp: 50000 }],
    },
    { clave: "llaves", k: 0, dia: 12, categoria: "OTRO", descripcion: "Copia de llaves (demo)", montoClp: 25000 },
  ],
  p2: [
    { clave: "refri", k: 4, dia: 10, categoria: "EQUIPAMIENTO", descripcion: "Refrigerador nuevo (demo)", montoClp: 280000 },
    { clave: "contrib", k: 2, dia: 15, categoria: "CONTRIBUCIONES", descripcion: "Cuota de contribuciones (demo)", montoClp: 185000 },
    {
      clave: "pintura", k: 1, dia: 8, categoria: "REPARACION", descripcion: "Mantención entre arriendos (demo)",
      conceptos: [
        { nombre: "Pintura", montoClp: 60000 },
        { nombre: "Cambio de cerradura", montoClp: 20000 },
        { nombre: "Limpieza", montoClp: 15000 },
      ],
    },
    { clave: "extra", k: 0, dia: 9, categoria: "GASTO_EXTRAORDINARIO", descripcion: "Gasto extraordinario edificio (demo)", montoClp: 60000 },
  ],
  p3: [
    { clave: "seguro", k: 3, dia: 11, categoria: "SEGURO", descripcion: "Seguro de contenido (demo)", montoClp: 38000 },
    {
      clave: "reparacion", k: 1, dia: 13, categoria: "REPARACION", descripcion: "Reparación de baño (demo)",
      conceptos: [{ nombre: "Grifería", montoClp: 90000 }, { nombre: "Instalación", montoClp: 60000 }],
    },
  ],
};

// Abonos recibidos de un pago de arriendo, según el escenario demo (fechas YYYY-MM-DD).
// Cubre: pagado a tiempo, pagado con atraso, parcial, vencido con parcial y pendiente.
function abonosDe(clave: string, k: number, periodo: string, esperado: number): { monto: number; fecha: string }[] {
  if (clave === "p1") return [{ monto: esperado, fecha: dia(periodo, 5) }];
  if (clave === "p2") {
    if (k === 3) return [{ monto: esperado, fecha: dia(addMes(periodo, 1), 3) }]; // pagado con atraso
    if (k === 0) return [{ monto: 260000, fecha: hoy }]; // parcial
    return [{ monto: esperado, fecha: dia(periodo, 26) }];
  }
  // p3
  if (k === 1) return [{ monto: 200000, fecha: dia(periodo, 20) }]; // vencido con abono parcial
  if (k === 0) return []; // pendiente
  return [{ monto: esperado, fecha: dia(periodo, 26) }];
}

// ───────────────────────── Carga ─────────────────────────

async function seedUsuarioDemo(prisma: PrismaClient) {
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan DEMO_USER_EMAIL y DEMO_USER_PASSWORD.");
  }
  if (!email.includes("@") || password.length < 12) {
    throw new Error("DEMO_USER_EMAIL inválido o DEMO_USER_PASSWORD con menos de 12 caracteres.");
  }
  if ((await prisma.usuario.count()) > 0) {
    console.log("Ya existe un usuario: no se modifican sus credenciales.");
    return;
  }
  await prisma.usuario.create({ data: { email, passwordHash: await argon2.hash(password) } });
  console.log("Usuario de demostración creado.");
}

async function main() {
  const url = exigirDestinoDemo();
  const prisma = new PrismaClient({ datasourceUrl: url });

  try {
    const idsDemo = DEMOS.map((d) => uid(d.clave, "propiedad"));
    const ajenas = await prisma.propiedad.count({ where: { id: { notIn: idsDemo } } });
    if (ajenas > 0) {
      throw new Error(
        `La base contiene ${ajenas} propiedad(es) que no son de la demo: se aborta para no mezclar datos.`
      );
    }

    await seedUsuarioDemo(prisma);

    const periodos = OFFSETS.map((k) => ({ k, periodo: addMes(mesActual, -k) }));
    let abonosCreados = 0;

    for (const d of DEMOS) {
      const propiedadId = uid(d.clave, "propiedad");
      await prisma.propiedad.upsert({
        where: { id: propiedadId },
        ...unaVez({
          id: propiedadId,
          numeroDepartamento: d.numeroDepartamento,
          direccion: d.direccion,
          superficieM2: d.superficieM2,
          valorCompraMonto: d.valorCompraMonto,
          valorCompraMoneda: d.valorCompraMoneda,
          fechaCompra: aFecha(d.fechaCompra),
          estacionamiento: d.estacionamiento,
          bodega: d.bodega,
        }),
      });

      // Crédito hipotecario con porcentaje de pie y registros mensuales.
      if (d.credito) {
        const c = d.credito;
        const creditoId = uid(d.clave, "credito");
        await prisma.creditoHipotecario.upsert({
          where: { id: creditoId },
          ...unaVez({
            id: creditoId,
            propiedadId,
            banco: c.banco,
            numeroCredito: c.numeroCredito,
            fechaOtorgamiento: aFecha(c.fechaOtorgamiento),
            montoOriginalUf: c.montoOriginalUf,
            cuotaContractualUf: c.cuotaContractualUf,
            tasaInteresAnual: c.tasaInteresAnual,
            numeroCuotasTotal: c.numeroCuotasTotal,
            segurosUf: c.segurosUf,
            diaVencimiento: c.diaVencimiento,
            saldoInicialUf: c.montoOriginalUf,
            porcentajePie: c.porcentajePie,
          }),
        });

        for (const { k, periodo } of periodos) {
          const fechaPago = dia(periodo, c.diaVencimiento);
          const pagado = fechaPago <= hoy; // no se registra un dividendo futuro
          const saldo = c.saldoUfHace5Meses - (5 - k) * c.amortizacionUfMes;
          const registroId = uid(d.clave, "registro", periodo);
          await prisma.creditoRegistroMensual.upsert({
            where: { id: registroId },
            ...unaVez({
              id: registroId,
              creditoId,
              periodo: aFecha(`${periodo}-01`),
              dividendoPagadoClp: pagado ? c.dividendoBaseClp + (5 - k) * 180 : null,
              fechaPagoDividendo: pagado ? aFecha(fechaPago) : null,
              saldoPendienteUf: Number(saldo.toFixed(4)),
            }),
          });
        }
      }

      // Arrendatario y contrato (inicia 6 meses atrás, dura 24 meses).
      const arrendatarioId = uid(d.clave, "arrendatario");
      await prisma.arrendatario.upsert({
        where: { id: arrendatarioId },
        ...unaVez({ id: arrendatarioId, nombre: d.arrendatario.nombre, email: d.arrendatario.email }),
      });

      const contratoId = uid(d.clave, "contrato");
      const inicio = addMes(mesActual, -6);
      await prisma.contratoArriendo.upsert({
        where: { id: contratoId },
        ...unaVez({
          id: contratoId,
          propiedadId,
          arrendatarioId,
          fechaInicio: aFecha(`${inicio}-01`),
          fechaTermino: aFecha(`${addMes(inicio, 24)}-01`),
          garantiaClp: d.montoMensualClp,
          diaEsperadoPago: d.diaPago,
          observaciones: "Contrato ficticio de demostración",
        }),
      });

      const montoBaseId = uid(d.clave, "monto", "base");
      await prisma.contratoMonto.upsert({
        where: { id: montoBaseId },
        ...unaVez({
          id: montoBaseId,
          contratoId,
          montoMensualClp: d.montoMensualClp,
          vigenteDesdePeriodo: aFecha(`${inicio}-01`),
          motivo: "Monto inicial",
        }),
      });
      if (d.reajuste) {
        const desde = addMes(mesActual, -d.reajuste.desdeK);
        const reajusteId = uid(d.clave, "monto", "reajuste");
        await prisma.contratoMonto.upsert({
          where: { id: reajusteId },
          ...unaVez({
            id: reajusteId,
            contratoId,
            montoMensualClp: d.reajuste.montoClp,
            vigenteDesdePeriodo: aFecha(`${desde}-01`),
            motivo: "Reajuste (demo)",
          }),
        });
      }

      // Pagos esperados y abonos recibidos (esperado vs recibido).
      for (const { k, periodo } of periodos) {
        const esperado =
          d.reajuste && k <= d.reajuste.desdeK ? d.reajuste.montoClp : d.montoMensualClp;
        const pagoId = uid(d.clave, "pago", periodo);
        await prisma.pagoEsperado.upsert({
          where: { id: pagoId },
          ...unaVez({
            id: pagoId,
            contratoId,
            periodo: aFecha(`${periodo}-01`),
            montoEsperadoClp: esperado,
            fechaEsperada: aFecha(dia(periodo, d.diaPago)),
          }),
        });

        const abonos = abonosDe(d.clave, k, periodo, esperado).filter((a) => a.fecha <= hoy);
        for (const [i, abono] of abonos.entries()) {
          const abonoId = uid(d.clave, "abono", periodo, String(i));
          await prisma.abonoArriendo.upsert({
            where: { id: abonoId },
            ...unaVez({
              id: abonoId,
              pagoEsperadoId: pagoId,
              montoClp: abono.monto,
              fechaRecepcion: aFecha(abono.fecha),
              medio: "Transferencia",
            }),
          });
          abonosCreados++;
        }
      }

      // Egresos manuales (simples y desglosados). El monto es siempre el total.
      for (const m of MOVIMIENTOS[d.clave] ?? []) {
        const periodo = addMes(mesActual, -m.k);
        const fecha = dia(periodo, m.dia) > hoy ? hoy : dia(periodo, m.dia);
        const total = m.conceptos
          ? m.conceptos.reduce((suma, c) => suma + c.montoClp, 0)
          : (m.montoClp ?? 0);
        const movimientoId = uid(d.clave, "movimiento", m.clave);
        await prisma.movimientoFinanciero.upsert({
          where: { id: movimientoId },
          ...unaVez({
            id: movimientoId,
            propiedadId,
            fecha: aFecha(fecha),
            categoria: m.categoria,
            montoClp: total,
            descripcion: m.descripcion,
          }),
        });
        for (const [orden, c] of (m.conceptos ?? []).entries()) {
          const conceptoId = uid(d.clave, "concepto", m.clave, String(orden));
          await prisma.movimientoConcepto.upsert({
            where: { id: conceptoId },
            ...unaVez({
              id: conceptoId,
              movimientoFinancieroId: movimientoId,
              nombre: c.nombre,
              montoClp: c.montoClp,
              orden,
            }),
          });
        }
      }
    }

    console.log(
      `Seed de demostración completado (${hoy}): ${DEMOS.length} propiedades, ` +
        `${periodos.length} meses de histórico, ${abonosCreados} abonos.`
    );
    const diaPagoP2 = DEMOS[1].diaPago;
    if (Number(hoy.slice(8)) > diaPagoP2) {
      console.warn(
        `Aviso: hoy es posterior al día ${diaPagoP2}; los pagos del mes actual de 205-B y 310-C ` +
          "aparecerán como vencidos en lugar de parcial/pendiente."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error ejecutando el seed de demostración:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
