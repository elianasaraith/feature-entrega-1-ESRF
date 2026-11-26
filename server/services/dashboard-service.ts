import type { PrismaClient } from "@prisma/client";
import { calcularEstadoPago, ordenarAbonos } from "@/server/domain/pago-estado";
import type { EstadoPago } from "@/server/domain/pago-estado";
import { rangoDelMes } from "@/server/domain/movimiento-agregacion";
import {
  type ActividadEntrada,
  type EstadoConsolidado,
  estadoConsolidado,
  flujoNeto,
  mesesHasta,
  ordenarActividad,
  seleccionarSaldoAplicable,
  sumarMontos,
} from "@/server/domain/dashboard";
import { sumarUf } from "@/server/domain/uf";
import { calcularEquivalenteClp } from "@/server/uf/equivalente";
import type { EquivalenteClpDto } from "@/server/uf/equivalente";
import type { UfService, ValorUfDto } from "@/server/uf/uf-service";
import { asegurarPropiedad } from "./propiedad-lookup";

// Totales de caja del mes (docs/data-model.md §7.1): ingresos por
// fecha_recepcion, dividendos por fecha_pago_dividendo y otros egresos por
// fecha. El período contractual o hipotecario nunca interviene. Los
// equivalentes en CLP de la UF (T10) son informativos y viven aparte: nunca
// participan en estos totales.
export type TotalesDto = {
  ingresosClp: string;
  dividendosClp: string;
  otrosEgresosClp: string;
  egresosTotalesClp: string;
  flujoNetoClp: string;
};

export type PagoMesDto = {
  id: string;
  propiedadId: string;
  contratoId: string;
  periodo: string; // YYYY-MM contractual
  montoEsperadoClp: string;
  recibidoClp: string;
  saldoPendienteClp: string;
  estado: EstadoPago;
  vencidoConAbonosParciales: boolean;
  pagadoConAtraso: boolean;
};

export type SaldoCreditoDto = { periodo: string; saldoPendienteUf: string };

// T10: variantes con el equivalente en CLP del saldo. Solo añaden el campo
// `equivalenteClp` (UF del MES CONSULTADO; el período del saldo se conserva);
// los DTO anteriores no cambian.
export type SaldoCreditoConEquivalenteDto = SaldoCreditoDto & { equivalenteClp: EquivalenteClpDto };
type ConSaldoEquivalente<T extends { saldoCredito: SaldoCreditoDto | null }> = Omit<T, "saldoCredito"> & {
  saldoCredito: SaldoCreditoConEquivalenteDto | null;
};
export type PropiedadResumenConEquivalenteDto = ConSaldoEquivalente<PropiedadResumenDto>;
// Saldo hipotecario de la cartera: suma exacta en UF de los últimos saldos
// aplicables y su equivalente en CLP (UF del mes consultado). `creditos.sinSaldo`
// son créditos vigentes sin saldo conocido: nunca aportan 0 al total.
export type SaldoConsolidadoDto = {
  totalUf: string | null;
  creditos: { total: number; conSaldo: number; sinSaldo: number };
  estado: EstadoConsolidado;
  equivalenteClp: EquivalenteClpDto;
};
export type ResumenMensualConEquivalentesDto = Omit<ResumenMensualDto, "propiedades"> & {
  propiedades: PropiedadResumenConEquivalenteDto[];
  saldoConsolidado: SaldoConsolidadoDto;
};

export type PeriodoHistoricoDto = TotalesDto & { mes: string };
export type HistoricoMensualDto = { mes: string; meses: number; periodos: PeriodoHistoricoDto[] };
export type ResumenPropiedadConEquivalenteDto = ConSaldoEquivalente<ResumenPropiedadDto>;

export type ActividadDto = ActividadEntrada & { propiedadId: string; href: string };

export type PropiedadResumenDto = TotalesDto & {
  propiedadId: string;
  numeroDepartamento: string;
  // null = sin crédito o sin registro con saldo hasta el mes consultado.
  saldoCredito: SaldoCreditoDto | null;
  pagos: PagoMesDto[];
};

export type ResumenMensualDto = {
  mes: string;
  totales: TotalesDto;
  propiedades: PropiedadResumenDto[];
};

export type ResumenPropiedadDto = PropiedadResumenDto & {
  mes: string;
  actividad: ActividadDto[];
};

const ETIQUETA_CATEGORIA: Record<string, string> = {
  REPARACION: "Reparación",
  EQUIPAMIENTO: "Equipamiento",
  SEGURO: "Seguro",
  CONTRIBUCIONES: "Contribuciones",
  GASTO_COMUN: "Gasto común",
  GASTO_EXTRAORDINARIO: "Gasto extraordinario",
  OTRO: "Otro",
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const aFecha = (f: string) => new Date(`${f}T00:00:00.000Z`);

function totales(ingresos: string[], dividendos: string[], otros: string[]): TotalesDto {
  const ingresosClp = sumarMontos(ingresos);
  const dividendosClp = sumarMontos(dividendos);
  const otrosEgresosClp = sumarMontos(otros);
  const egresosTotalesClp = sumarMontos([dividendosClp, otrosEgresosClp]);
  return {
    ingresosClp,
    dividendosClp,
    otrosEgresosClp,
    egresosTotalesClp,
    flujoNetoClp: flujoNeto(ingresosClp, egresosTotalesClp),
  };
}

// Un solo servicio para cartera y propiedad (architecture.md §10.4). Solo
// lectura: no escribe ni persiste ningún derivado. Las filas del mes se
// consultan una vez por tabla (sin N+1) y se agrupan por propiedad con bigint.
// `uf` es opcional y solo lo usan los métodos *ConEquivalentes: los demás nunca
// consultan la UF ni al proveedor.
export function createDashboardService(prisma: PrismaClient, uf?: UfService) {
  // La UF del mes consultado: un único período por solicitud, y solo si algún
  // saldo la necesita. Cualquier fallo deja el equivalente en null.
  async function ufDelMes(mes: string, hayAlgunSaldo: boolean): Promise<ValorUfDto | undefined> {
    if (!uf || !hayAlgunSaldo) return undefined;
    try {
      return (await uf.obtenerValores([mes])).get(mes);
    } catch (error) {
      console.error("No se pudo resolver la UF para el equivalente del dashboard", error);
      return undefined;
    }
  }

  function conEquivalente(
    saldo: SaldoCreditoDto | null,
    valorUf: ValorUfDto | undefined
  ): SaldoCreditoConEquivalenteDto | null {
    return saldo
      ? { ...saldo, equivalenteClp: calcularEquivalenteClp(saldo.saldoPendienteUf, valorUf) }
      : null;
  }

  async function calcular(mes: string, hoy: string, propiedadId?: string) {
    const { desde, hasta } = rangoDelMes(mes);
    const rango = { gte: aFecha(desde), lt: aFecha(hasta) };

    const propiedades = await prisma.propiedad.findMany({
      where: propiedadId ? { id: propiedadId } : undefined,
      select: { id: true, numeroDepartamento: true },
      orderBy: [{ createdAt: "asc" }, { numeroDepartamento: "asc" }],
    });
    const ids = propiedades.map((p) => p.id);
    const deLaCartera = { in: ids };

    const [abonos, dividendos, movimientos, pagos, saldos] = await Promise.all([
      prisma.abonoArriendo.findMany({
        where: { fechaRecepcion: rango, pagoEsperado: { contrato: { propiedadId: deLaCartera } } },
        include: { pagoEsperado: { select: { periodo: true, contrato: { select: { id: true, propiedadId: true } } } } },
      }),
      prisma.creditoRegistroMensual.findMany({
        where: {
          fechaPagoDividendo: rango,
          dividendoPagadoClp: { not: null },
          credito: { propiedadId: deLaCartera },
        },
        include: { credito: { select: { propiedadId: true } } },
      }),
      prisma.movimientoFinanciero.findMany({
        where: { propiedadId: deLaCartera, fecha: rango },
      }),
      // Período contractual: el estado se deriva sobre TODOS los abonos del pago.
      prisma.pagoEsperado.findMany({
        where: { periodo: aFecha(desde), contrato: { propiedadId: deLaCartera } },
        include: { abonos: true, contrato: { select: { propiedadId: true } } },
        orderBy: { createdAt: "asc" },
      }),
      // Último registro con saldo por crédito, hasta el mes consultado inclusive.
      prisma.creditoRegistroMensual.findMany({
        where: {
          saldoPendienteUf: { not: null },
          periodo: { lt: aFecha(hasta) },
          credito: { propiedadId: deLaCartera },
        },
        orderBy: { periodo: "desc" },
        distinct: ["creditoId"],
        include: { credito: { select: { propiedadId: true } } },
      }),
    ]);

    const actividadPorPropiedad = new Map<string, ActividadDto[]>();
    const agregar = (a: ActividadDto) => {
      const lista = actividadPorPropiedad.get(a.propiedadId) ?? [];
      lista.push(a);
      actividadPorPropiedad.set(a.propiedadId, lista);
    };
    for (const a of abonos) {
      const pid = a.pagoEsperado.contrato.propiedadId;
      agregar({
        id: a.id,
        origen: "ABONO",
        fecha: isoDate(a.fechaRecepcion),
        concepto: `Arriendo ${isoDate(a.pagoEsperado.periodo).slice(0, 7)}`,
        montoClp: a.montoClp.toString(),
        propiedadId: pid,
        href: `/propiedades/${pid}/contratos/${a.pagoEsperado.contrato.id}/pagos`,
      });
    }
    for (const d of dividendos) {
      const pid = d.credito.propiedadId;
      agregar({
        id: d.id,
        origen: "DIVIDENDO",
        fecha: isoDate(d.fechaPagoDividendo as Date),
        concepto: `Dividendo ${isoDate(d.periodo).slice(0, 7)}`,
        montoClp: (d.dividendoPagadoClp as { toString(): string }).toString(),
        propiedadId: pid,
        href: `/propiedades/${pid}/credito/registro-mensual`,
      });
    }
    for (const m of movimientos) {
      agregar({
        id: m.id,
        origen: "MOVIMIENTO",
        fecha: isoDate(m.fecha),
        concepto: m.descripcion ?? ETIQUETA_CATEGORIA[m.categoria] ?? m.categoria,
        montoClp: m.montoClp.toString(),
        propiedadId: m.propiedadId,
        href: `/propiedades/${m.propiedadId}/movimientos?mes=${mes}`,
      });
    }

    const pagosPorPropiedad = new Map<string, PagoMesDto[]>();
    for (const p of pagos) {
      const pid = p.contrato.propiedadId;
      const abonosEntrada = ordenarAbonos(
        p.abonos.map((a) => ({
          id: a.id,
          montoClp: a.montoClp.toString(),
          fechaRecepcion: isoDate(a.fechaRecepcion),
          createdAt: a.createdAt.toISOString(),
        }))
      );
      const montoEsperadoClp = p.montoEsperadoClp.toString();
      const calc = calcularEstadoPago(
        { montoEsperadoClp, fechaEsperada: isoDate(p.fechaEsperada), abonos: abonosEntrada },
        hoy
      );
      const lista = pagosPorPropiedad.get(pid) ?? [];
      lista.push({
        id: p.id,
        propiedadId: pid,
        contratoId: p.contratoId,
        periodo: isoDate(p.periodo).slice(0, 7),
        montoEsperadoClp,
        recibidoClp: calc.recibidoClp,
        saldoPendienteClp: calc.saldoPendienteClp,
        estado: calc.estado,
        vencidoConAbonosParciales: calc.vencidoConAbonosParciales,
        pagadoConAtraso: calc.pagadoConAtraso,
      });
      pagosPorPropiedad.set(pid, lista);
    }

    const saldosPorPropiedad = new Map<string, SaldoCreditoDto | null>();
    for (const s of saldos) {
      saldosPorPropiedad.set(
        s.credito.propiedadId,
        seleccionarSaldoAplicable(
          [{ periodo: isoDate(s.periodo).slice(0, 7), saldoPendienteUf: s.saldoPendienteUf?.toString() ?? null }],
          mes
        )
      );
    }

    const filas: PropiedadResumenDto[] = propiedades.map((p) => {
      const act = actividadPorPropiedad.get(p.id) ?? [];
      const de = (origen: ActividadDto["origen"]) =>
        act.filter((a) => a.origen === origen).map((a) => a.montoClp);
      return {
        propiedadId: p.id,
        numeroDepartamento: p.numeroDepartamento,
        ...totales(de("ABONO"), de("DIVIDENDO"), de("MOVIMIENTO")),
        saldoCredito: saldosPorPropiedad.get(p.id) ?? null,
        pagos: pagosPorPropiedad.get(p.id) ?? [],
      };
    });
    return { filas, actividadPorPropiedad };
  }

  return {
    // Cartera: el total es la suma de las filas por propiedad, en el orden
    // estable de propiedadService.listar (sin ranking).
    async resumenMensual(mes: string, hoy: string): Promise<ResumenMensualDto> {
      const { filas } = await calcular(mes, hoy);
      return {
        mes,
        totales: totales(
          filas.map((f) => f.ingresosClp),
          filas.map((f) => f.dividendosClp),
          filas.map((f) => f.otrosEgresosClp)
        ),
        propiedades: filas,
      };
    },

    // Mismos cálculos que resumenMensual (se reutiliza tal cual) + equivalente del
    // saldo + consolidado. La UF del mes se resuelve una sola vez para ambos.
    async resumenMensualConEquivalentes(mes: string, hoy: string): Promise<ResumenMensualConEquivalentesDto> {
      const base = await this.resumenMensual(mes, hoy);
      const conSaldo = base.propiedades.filter((p) => p.saldoCredito !== null);
      const valorUf = await ufDelMes(mes, conSaldo.length > 0);

      // Universo de créditos: los de la cartera ya otorgados al cierre del mes
      // consultado (fecha de otorgamiento desconocida = vigente), más cualquiera
      // con saldo aplicable. Un crédito aún no otorgado no cuenta como "sin saldo".
      const { hasta } = rangoDelMes(mes);
      const creditos = await prisma.creditoHipotecario.findMany({
        where: {
          propiedadId: { in: base.propiedades.map((p) => p.propiedadId) },
          OR: [{ fechaOtorgamiento: null }, { fechaOtorgamiento: { lt: aFecha(hasta) } }],
        },
        select: { propiedadId: true },
      });
      const universo = new Set(creditos.map((c) => c.propiedadId));
      for (const p of conSaldo) universo.add(p.propiedadId);

      const totalUf = conSaldo.length > 0 ? sumarUf(conSaldo.map((p) => (p.saldoCredito as SaldoCreditoDto).saldoPendienteUf)) : null;
      return {
        ...base,
        propiedades: base.propiedades.map((p) => ({ ...p, saldoCredito: conEquivalente(p.saldoCredito, valorUf) })),
        saldoConsolidado: {
          totalUf,
          creditos: { total: universo.size, conSaldo: conSaldo.length, sinSaldo: universo.size - conSaldo.length },
          estado: estadoConsolidado(conSaldo.length, universo.size),
          equivalenteClp: calcularEquivalenteClp(totalUf, valorUf),
        },
      };
    },

    // Totales de caja de los `meses` meses que terminan en `mesFin`. Tres consultas
    // por rango, agrupadas por mes con la misma `totales()` del dashboard mensual.
    // No consulta la UF.
    async historico(mesFin: string, meses: number): Promise<HistoricoMensualDto> {
      const lista = mesesHasta(mesFin, meses);
      const rango = { gte: aFecha(rangoDelMes(lista[0]).desde), lt: aFecha(rangoDelMes(mesFin).hasta) };
      const [abonos, dividendos, movimientos] = await Promise.all([
        prisma.abonoArriendo.findMany({ where: { fechaRecepcion: rango }, select: { fechaRecepcion: true, montoClp: true } }),
        prisma.creditoRegistroMensual.findMany({
          where: { fechaPagoDividendo: rango, dividendoPagadoClp: { not: null } },
          select: { fechaPagoDividendo: true, dividendoPagadoClp: true },
        }),
        prisma.movimientoFinanciero.findMany({ where: { fecha: rango }, select: { fecha: true, montoClp: true } }),
      ]);
      const porMes = new Map<string, { ingresos: string[]; dividendos: string[]; otros: string[] }>(
        lista.map((m) => [m, { ingresos: [], dividendos: [], otros: [] }])
      );
      const poner = (fecha: Date | null, monto: { toString(): string } | null, clave: "ingresos" | "dividendos" | "otros") => {
        if (!fecha || monto === null) return;
        porMes.get(isoDate(fecha).slice(0, 7))?.[clave].push(monto.toString());
      };
      for (const a of abonos) poner(a.fechaRecepcion, a.montoClp, "ingresos");
      for (const d of dividendos) poner(d.fechaPagoDividendo, d.dividendoPagadoClp, "dividendos");
      for (const m of movimientos) poner(m.fecha, m.montoClp, "otros");
      return {
        mes: mesFin,
        meses,
        periodos: lista.map((m) => {
          const f = porMes.get(m) as { ingresos: string[]; dividendos: string[]; otros: string[] };
          return { mes: m, ...totales(f.ingresos, f.dividendos, f.otros) };
        }),
      };
    },

    async resumenPropiedadConEquivalentes(
      propiedadId: string,
      mes: string,
      hoy: string
    ): Promise<ResumenPropiedadConEquivalenteDto> {
      const base = await this.resumenPropiedad(propiedadId, mes, hoy);
      const valorUf = await ufDelMes(mes, base.saldoCredito !== null);
      return { ...base, saldoCredito: conEquivalente(base.saldoCredito, valorUf) };
    },

    async resumenPropiedad(propiedadId: string, mes: string, hoy: string): Promise<ResumenPropiedadDto> {
      await asegurarPropiedad(prisma, propiedadId);
      const { filas, actividadPorPropiedad } = await calcular(mes, hoy, propiedadId);
      return {
        mes,
        ...filas[0],
        actividad: ordenarActividad(actividadPorPropiedad.get(propiedadId) ?? []),
      };
    },
  };
}
