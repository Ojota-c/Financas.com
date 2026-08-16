/**
 * A paleta categórica dos gráficos, na ORDEM FIXA em que as séries a recebem
 * (regra do design system: a cor segue a entidade, nunca a posição que sobrou
 * depois de um filtro). Os valores vivem em globals.css; aqui só as referências.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/**
 * Fatia N de um conjunto categórico. Além da 6ª série o certo é agrupar em
 * "Outros" — cor gerada em runtime nunca.
 */
export function chartColor(indice: number): string {
  return CHART_COLORS[indice % CHART_COLORS.length]!;
}

/** Quantas categorias aparecem sozinhas antes de virar "Outros". */
export const MAX_FATIAS = 5;
