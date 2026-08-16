"use client";

import { useSyncExternalStore } from "react";

import { sankey, sankeyLinkHorizontal, type SankeyNode } from "d3-sankey";

import { formatCents, type Cents } from "@/lib/finance";

const assinaturaVazia = () => () => {};

/**
 * `true` só depois de hidratar. O layout do d3-sankey diverge por casas de
 * ponto flutuante entre o Node do servidor e o browser, e o React acusa
 * mismatch — então o SVG só nasce no cliente, no lugar de um placeholder da
 * mesma altura (sem salto de layout).
 */
function useHidratado(): boolean {
  return useSyncExternalStore(
    assinaturaVazia,
    () => true,
    () => false,
  );
}

export type FluxoDeRenda = {
  incomeCents: Cents;
  gastos: { parentName: string; bucket: string | null; totalCents: Cents }[];
};

type No = { nome: string; cor: string; linkNeutro?: boolean };
type Ligacao = { source: number; target: number; value: number };

const COR_DO_BUCKET: Record<string, string> = {
  needs: "var(--chart-1)",
  wants: "var(--chart-2)",
  savings: "var(--chart-4)",
};

const ROTULO_DO_BUCKET: Record<string, string> = {
  needs: "Necessidades",
  wants: "Desejos",
  savings: "Guardado",
};

const LARGURA = 640;
const ALTURA = 360;

/**
 * Sankey de fluxo de renda (§5.2): a renda entra à esquerda, se ramifica em
 * necessidades/desejos/guardado e cada braço se abre nos grupos de categoria.
 * Layout do d3-sankey; o desenho é SVG nosso, com os tokens do tema.
 *
 * Sobra (renda − gasto) vira um ramo próprio — dinheiro que ficou também é
 * destino, e ver a fatia "sobrou" crescer é o ponto do gráfico.
 */
export function SankeyRenda({ fluxo }: { fluxo: FluxoDeRenda }) {
  const hidratado = useHidratado();

  const nos: No[] = [{ nome: "Renda", cor: "var(--accent)" }];
  const ligacoes: Ligacao[] = [];

  const indicePorBucket = new Map<string, number>();
  const gastoTotal = fluxo.gastos.reduce((soma, g) => soma + g.totalCents, 0);

  for (const gasto of fluxo.gastos) {
    const bucket = gasto.bucket ?? "wants";

    if (!indicePorBucket.has(bucket)) {
      indicePorBucket.set(bucket, nos.length);
      nos.push({
        nome: ROTULO_DO_BUCKET[bucket] ?? bucket,
        cor: COR_DO_BUCKET[bucket] ?? "var(--chart-3)",
      });
    }
  }

  // Renda → bucket
  const somaPorBucket = new Map<string, number>();
  for (const gasto of fluxo.gastos) {
    const bucket = gasto.bucket ?? "wants";
    somaPorBucket.set(
      bucket,
      (somaPorBucket.get(bucket) ?? 0) + gasto.totalCents,
    );
  }
  for (const [bucket, soma] of somaPorBucket) {
    ligacoes.push({
      source: 0,
      target: indicePorBucket.get(bucket)!,
      value: soma,
    });
  }

  // bucket → categoria pai
  for (const gasto of fluxo.gastos) {
    const bucket = gasto.bucket ?? "wants";
    const indiceDoPai = nos.length;
    const existente = nos.findIndex((no) => no.nome === gasto.parentName);

    const alvo =
      existente >= 0
        ? existente
        : (nos.push({
            nome: gasto.parentName,
            cor: COR_DO_BUCKET[bucket] ?? "var(--chart-3)",
          }),
          indiceDoPai);

    ligacoes.push({
      source: indicePorBucket.get(bucket)!,
      target: alvo,
      value: gasto.totalCents,
    });
  }

  // Renda → sobra. O nó é dourado (conquista); o LINK fica neutro — um fluxo
  // dourado translúcido sobre fundo escuro vira um marrom que domina a tela e
  // rouba o foco dos ramos de gasto, que são o assunto do gráfico.
  const sobra = fluxo.incomeCents - gastoTotal;
  if (sobra > 0) {
    nos.push({ nome: "Sobrou", cor: "var(--gold)", linkNeutro: true });
    ligacoes.push({ source: 0, target: nos.length - 1, value: sobra });
  }

  if (ligacoes.length === 0) return null;

  if (!hidratado) {
    return <div aria-hidden className="h-[360px] min-w-[560px]" />;
  }

  const gerador = sankey<No, Ligacao>()
    .nodeWidth(10)
    .nodePadding(14)
    .extent([
      [0, 8],
      [LARGURA, ALTURA - 8],
    ]);

  const grafo = gerador({
    nodes: nos.map((no) => ({ ...no })),
    links: ligacoes.map((ligacao) => ({ ...ligacao })),
  });

  const caminho = sankeyLinkHorizontal<No, Ligacao>();

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full min-w-[560px]"
        role="img"
        aria-label="Fluxo da renda entre necessidades, desejos e o que sobrou"
      >
        {grafo.links.map((ligacao, indice) => {
          const origem = ligacao.source as SankeyNode<No, Ligacao>;
          const destino = ligacao.target as SankeyNode<No, Ligacao>;

          return (
            <path
              key={indice}
              d={caminho(ligacao) ?? undefined}
              fill="none"
              stroke={destino.linkNeutro ? "var(--text-dim)" : destino.cor}
              strokeOpacity={destino.linkNeutro ? 0.12 : 0.25}
              strokeWidth={Math.max(ligacao.width ?? 1, 1)}
            >
              <title>
                {origem.nome} → {destino.nome}:{" "}
                {formatCents(ligacao.value as Cents)}
              </title>
            </path>
          );
        })}

        {grafo.nodes.map((no, indice) => {
          const altura = (no.y1 ?? 0) - (no.y0 ?? 0);
          const aEsquerda = (no.x0 ?? 0) < LARGURA / 2;

          return (
            <g key={indice}>
              <rect
                x={no.x0}
                y={no.y0}
                width={(no.x1 ?? 0) - (no.x0 ?? 0)}
                height={Math.max(altura, 2)}
                rx={3}
                fill={no.cor}
              >
                <title>
                  {no.nome}: {formatCents((no.value ?? 0) as Cents)}
                </title>
              </rect>
              <text
                x={aEsquerda ? (no.x1 ?? 0) + 8 : (no.x0 ?? 0) - 8}
                y={((no.y0 ?? 0) + (no.y1 ?? 0)) / 2}
                dominantBaseline="middle"
                textAnchor={aEsquerda ? "start" : "end"}
                className="fill-[var(--text-mid)] text-[11px]"
              >
                {no.nome}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
