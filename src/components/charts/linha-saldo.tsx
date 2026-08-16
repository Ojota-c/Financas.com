"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { type Cents } from "@/lib/finance";
import { dataCurta } from "@/lib/utils/dates";

import { ChartTooltip } from "./chart-tooltip";
import { reaisCompactos } from "./format";

export type PontoDeSaldo = { date: string; saldoCents: Cents };

/**
 * Evolução do saldo consolidado. Série única — o título nomeia, sem legenda.
 * É a ÚNICA linha com glow da tela (§7: neon só na série ativa; se tudo
 * brilha, nada brilha): gradiente vertical do acento até transparente e
 * drop-shadow sutil na linha.
 */
export function LinhaSaldo({ pontos }: { pontos: PontoDeSaldo[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ left: 0, right: 0, top: 6 }}>
          <defs>
            <linearGradient id="saldo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="date"
            tickFormatter={dataCurta}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
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
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: 3 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <ChartTooltip
                  titulo={dataCurta(String(label))}
                  linhas={[
                    {
                      nome: "Saldo",
                      cor: "var(--accent)",
                      valorCents: Number(payload[0]!.value),
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="saldoCents"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#saldo-fill)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
            style={{
              filter:
                "drop-shadow(0 0 6px color-mix(in oklab, var(--accent) 35%, transparent))",
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
