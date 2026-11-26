"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { clp } from "../_lib/format";
import { mesCorto, mesLargo } from "../_lib/format";
import type { PeriodoHistoricoDto } from "@/server/services/dashboard-service";

// Los importes llegan como string exacto; Number() se usa SOLO para dibujar
// los ejes. Las cifras mostradas en tooltips y tablas usan el string original.
type Punto = { mes: string; etiqueta: string; ingresos: number; egresos: number; flujo: number; ingresosTxt: string; egresosTxt: string; flujoTxt: string };

function aPuntos(periodos: PeriodoHistoricoDto[]): Punto[] {
  return periodos.map((p) => ({
    mes: p.mes,
    etiqueta: mesCorto(p.mes),
    ingresos: Number(p.ingresosClp),
    egresos: Number(p.egresosTotalesClp),
    flujo: Number(p.flujoNetoClp),
    ingresosTxt: p.ingresosClp,
    egresosTxt: p.egresosTotalesClp,
    flujoTxt: p.flujoNetoClp,
  }));
}

function ejeCompacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `${Math.round(v / 1_000)} mil`;
  return String(v);
}

type TooltipProps = { active?: boolean; payload?: { payload: Punto }[]; claves: { clave: keyof Punto; etiqueta: string; color: string }[] };

function Globo({ active, payload, claves }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold capitalize text-ink">{mesLargo(p.mes)}</p>
      {claves.map((c) => (
        <p key={c.etiqueta} className="flex items-center gap-2 tabular-nums text-muted">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c.color }} />
          {c.etiqueta}: <span className="font-medium text-ink">{clp(String(p[c.clave]))}</span>
        </p>
      ))}
    </div>
  );
}

const EJE = { fontSize: 11, fill: "#5b6b7f" };

export function HistoricoGraficos({ periodos }: { periodos: PeriodoHistoricoDto[] }) {
  const datos = aPuntos(periodos);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure role="img" aria-label="Gráfico de barras de ingresos y egresos por mes. Los valores exactos están en la tabla del histórico." className="min-w-0">
        <figcaption className="mb-2 text-sm font-medium text-ink">Ingresos y egresos</figcaption>
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={ejeCompacto} width={52} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                content={<Globo claves={[{ clave: "ingresosTxt", etiqueta: "Ingresos", color: "#059669" }, { clave: "egresosTxt", etiqueta: "Egresos", color: "#dc2626" }]} />}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure role="img" aria-label="Gráfico de línea de la evolución del flujo neto mensual. Los valores exactos están en la tabla del histórico." className="min-w-0">
        <figcaption className="mb-2 text-sm font-medium text-ink">Evolución del flujo neto</figcaption>
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={ejeCompacto} width={52} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Tooltip content={<Globo claves={[{ clave: "flujoTxt", etiqueta: "Flujo neto", color: "#2563eb" }]} />} />
              <Line type="linear" dataKey="flujo" name="Flujo neto" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
