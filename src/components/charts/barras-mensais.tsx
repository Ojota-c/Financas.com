"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type Cents } from "@/lib/finance";

import { ChartTooltip } from "./chart-tooltip";
import { mesCurto, reaisCompactos } from "./format";

export type MesComparado = {
  /** "2026-08" */
  mes: string;
  incomeCents: Cents;
  expenseCents: Cents;
};

/**
 * Receita vs despesa mês a mês. As duas séries usam os tokens semânticos de
 * polaridade (--positive/--negative) e não a paleta categórica: aqui a cor
 * COMUNICA entra/sai, não identidade arbitrária. Legenda presente mesmo assim —
 * cor nunca é o único canal.
 */
export function BarrasMensais({ meses }: { meses: MesComparado[] }) {
  return (
    <div className="grid gap-2">
      <div className="text-text-mid flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-positive size-2 rounded-full" />
          Receita
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-negative size-2 rounded-full" />
          Despesa
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={meses} barGap={2} margin={{ left: 0, right: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="mes"
              tickFormatter={mesCurto}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(valor: number) => reaisCompactos(valor)}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "var(--text-dim)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--glass)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ChartTooltip
                    titulo={mesCurto(String(label))}
                    linhas={payload.map((serie) => ({
                      nome:
                        serie.dataKey === "incomeCents" ? "Receita" : "Despesa",
                      cor:
                        serie.dataKey === "incomeCents"
                          ? "var(--positive)"
                          : "var(--negative)",
                      valorCents: Number(serie.value),
                    }))}
                  />
                );
              }}
            />
            <Bar
              dataKey="incomeCents"
              fill="var(--positive)"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenseCents"
              fill="var(--negative)"
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
