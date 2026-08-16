"use client";

import { formatCents, type Cents } from "@/lib/finance";

/**
 * Tooltip em vidro (§7), compartilhado por todos os gráficos: título, linhas
 * com o marcador de cor da série e valor em tabular-nums. O Recharts injeta as
 * props; a gente só cuida da moldura.
 */
export function ChartTooltip({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { nome: string; cor: string; valorCents: Cents }[];
}) {
  return (
    <div className="glass min-w-40 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-text-mid mb-1">{titulo}</p>
      <ul className="grid gap-1">
        {linhas.map((linha) => (
          <li
            key={linha.nome}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: linha.cor }}
              />
              <span className="text-text-mid">{linha.nome}</span>
            </span>
            <span className="font-medium tabular-nums">
              {formatCents(linha.valorCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
