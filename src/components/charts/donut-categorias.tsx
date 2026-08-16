"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCents, sumCents, type Cents } from "@/lib/finance";

import { ChartTooltip } from "./chart-tooltip";
import { chartColor, MAX_FATIAS } from "./palette";

export type FatiaDeCategoria = { nome: string; totalCents: Cents };

/**
 * Donut de gastos por categoria (§5.2). As 5 maiores aparecem; o resto vira
 * "Outros" — cor nova gerada em runtime é proibido pelo design system, e um
 * donut de 14 fatias não informa nada.
 *
 * A legenda é lista ao lado/abaixo, com nome e valor — identidade nunca só
 * pela cor. O total vive no centro.
 */
export function DonutCategorias({ fatias }: { fatias: FatiaDeCategoria[] }) {
  const ordenadas = [...fatias].sort((a, b) => b.totalCents - a.totalCents);

  const principais = ordenadas.slice(0, MAX_FATIAS);
  const resto = ordenadas.slice(MAX_FATIAS);

  const dados =
    resto.length > 0
      ? [
          ...principais,
          {
            nome: "Outros",
            totalCents: sumCents(resto.map((f) => f.totalCents)),
          },
        ]
      : principais;

  const total = sumCents(dados.map((f) => f.totalCents));

  if (total === 0) return null;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[11rem_1fr]">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="totalCents"
              nameKey="nome"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {dados.map((fatia, indice) => (
                <Cell key={fatia.nome} fill={chartColor(indice)} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]!;
                return (
                  <ChartTooltip
                    titulo="Gasto do período"
                    linhas={[
                      {
                        nome: String(item.name),
                        cor: String(item.payload?.fill ?? ""),
                        valorCents: Number(item.value),
                      },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-text-dim text-[10px] tracking-wide uppercase">
              Total
            </p>
            <p className="money text-sm">{formatCents(total)}</p>
          </div>
        </div>
      </div>

      <ul className="grid gap-1.5 text-sm">
        {dados.map((fatia, indice) => {
          const proporcao =
            total > 0 ? Math.round((fatia.totalCents / total) * 100) : 0;

          return (
            <li
              key={fatia.nome}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chartColor(indice) }}
                />
                <span className="text-text-mid truncate">{fatia.nome}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatCents(fatia.totalCents, { symbol: false })}
                <span className="text-text-dim ml-2 inline-block w-8 text-right text-xs">
                  {proporcao}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
