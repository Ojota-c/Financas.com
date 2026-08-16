"use client";

import { formatCents, type Cents } from "@/lib/finance";
import { cn } from "@/lib/utils/cn";

export type DiaDeGasto = { date: string; totalCents: Cents };

/**
 * Heatmap anual estilo GitHub (§5.2): 53 colunas de semanas, intensidade =
 * gasto do dia. Rampa SEQUENCIAL de um matiz só (o acento), em degraus de
 * color-mix sobre a superfície — luminosidade monotônica, como manda a regra
 * de rampa. Zero é a superfície vazia.
 */
const DEGRAUS = [
  "transparent",
  "color-mix(in oklab, var(--accent) 18%, transparent)",
  "color-mix(in oklab, var(--accent) 38%, transparent)",
  "color-mix(in oklab, var(--accent) 62%, transparent)",
  "color-mix(in oklab, var(--accent) 88%, transparent)",
] as const;

const ROTULO_DO_MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

function grade(dias: DiaDeGasto[], ano: number) {
  const porData = new Map(dias.map((d) => [d.date, d.totalCents]));

  // Quartis do que tem gasto — o degrau é relativo ao próprio ano da pessoa,
  // não a um valor absoluto que não significa nada.
  const valores = dias
    .map((d) => d.totalCents)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const quartil = (q: number) =>
    valores.length === 0 ? 0 : valores[Math.floor((valores.length - 1) * q)]!;

  const [q1, q2, q3] = [quartil(0.25), quartil(0.5), quartil(0.75)];

  function degrau(cents: Cents): number {
    if (cents <= 0) return 0;
    if (cents <= q1) return 1;
    if (cents <= q2) return 2;
    if (cents <= q3) return 3;
    return 4;
  }

  // Colunas = semanas, linhas = dom..sáb, como o GitHub.
  const primeiro = new Date(Date.UTC(ano, 0, 1));
  const inicioDaGrade = new Date(primeiro);
  inicioDaGrade.setUTCDate(primeiro.getUTCDate() - primeiro.getUTCDay());

  const semanas: { date: string; nivel: number; cents: Cents }[][] = [];
  const rotulos: { coluna: number; mes: string }[] = [];
  let mesAnterior = -1;

  const cursor = new Date(inicioDaGrade);

  for (let coluna = 0; coluna < 53; coluna += 1) {
    const semana: { date: string; nivel: number; cents: Cents }[] = [];

    for (let linha = 0; linha < 7; linha += 1) {
      const dentroDoAno = cursor.getUTCFullYear() === ano;
      const iso = cursor.toISOString().slice(0, 10);
      const cents = porData.get(iso) ?? 0;

      semana.push({
        date: iso,
        nivel: dentroDoAno ? degrau(cents) : -1,
        cents,
      });

      if (dentroDoAno && cursor.getUTCDate() <= 7 && linha === 0) {
        const mes = cursor.getUTCMonth();
        if (mes !== mesAnterior) {
          rotulos.push({ coluna, mes: ROTULO_DO_MES[mes]! });
          mesAnterior = mes;
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    semanas.push(semana);
  }

  return { semanas, rotulos };
}

export function HeatmapAnual({
  dias,
  ano,
}: {
  dias: DiaDeGasto[];
  ano: number;
}) {
  const { semanas, rotulos } = grade(dias, ano);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="text-text-dim relative mb-1 h-4 text-[10px]">
          {rotulos.map((rotulo) => (
            <span
              key={`${rotulo.mes}-${rotulo.coluna}`}
              className="absolute"
              style={{ left: `${rotulo.coluna * 12}px` }}
            >
              {rotulo.mes}
            </span>
          ))}
        </div>

        <div className="flex gap-[2px]">
          {semanas.map((semana, indiceSemana) => (
            <div key={indiceSemana} className="grid gap-[2px]">
              {semana.map((dia) => (
                <div
                  key={dia.date}
                  title={
                    dia.nivel >= 0
                      ? `${dia.date} · ${dia.cents > 0 ? formatCents(dia.cents) : "sem gasto"}`
                      : undefined
                  }
                  aria-label={
                    dia.nivel >= 0
                      ? `${dia.date}: ${dia.cents > 0 ? formatCents(dia.cents) : "sem gasto"}`
                      : undefined
                  }
                  className={cn(
                    "size-[10px] rounded-[2px]",
                    dia.nivel < 0 && "opacity-0",
                    dia.nivel === 0 && "bg-surface-2",
                  )}
                  style={
                    dia.nivel > 0
                      ? { backgroundColor: DEGRAUS[dia.nivel] }
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>

        <div className="text-text-dim mt-2 flex items-center justify-end gap-1 text-[10px]">
          menos
          {DEGRAUS.map((cor, nivel) => (
            <span
              key={nivel}
              aria-hidden
              className={cn(
                "size-[10px] rounded-[2px]",
                nivel === 0 && "bg-surface-2",
              )}
              style={nivel > 0 ? { backgroundColor: cor } : undefined}
            />
          ))}
          mais
        </div>
      </div>
    </div>
  );
}
