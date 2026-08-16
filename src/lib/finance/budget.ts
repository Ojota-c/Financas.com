/**
 * Orçamento: divisão por buckets (§6.2), aderência, progresso de categoria com
 * rollover e o nível de alerta de 80%/100% (§5.1).
 */

import { allocate, type Cents } from "./money";

/** Buckets do método 50/30/20 — o campo `bucket` das categorias (§6.2). */
export type BudgetBucket = "needs" | "wants" | "savings";

/** Pesos inteiros por bucket. A validação é a do próprio `allocate`. */
export type BucketWeights = Readonly<Record<BudgetBucket, number>>;

/** 50/30/20 é o padrão do onboarding; o app permite ajustar, não impõe (§6.2). */
export const DEFAULT_BUCKET_WEIGHTS: BucketWeights = {
  needs: 50,
  wants: 30,
  savings: 20,
};

/**
 * Divide a renda pelos buckets preservando a soma: o rateio é o `allocate` do
 * money.ts, então `needs + wants + savings === income`, sempre — arredondar
 * cada bucket por conta própria perderia centavos entre eles.
 */
export function splitByBuckets(
  incomeCents: Cents,
  weights: BucketWeights = DEFAULT_BUCKET_WEIGHTS,
): Record<BudgetBucket, Cents> {
  const [needs, wants, savings] = allocate(incomeCents, [
    weights.needs,
    weights.wants,
    weights.savings,
  ]);

  return { needs: needs!, wants: wants!, savings: savings! };
}

export type CategorySpending = {
  spentCents: Cents;
  limitCents: Cents;
};

/**
 * Aderência ao orçamento: fração (0–1) das categorias com gasto dentro do
 * teto — é o insumo do componente de 15 pontos do score (§5.2).
 * Sem categoria orçada não há teto a violar: aderência 1, nunca NaN.
 */
export function budgetAdherence(
  categories: readonly CategorySpending[],
): number {
  if (categories.length === 0) return 1;

  let within = 0;

  for (const category of categories) {
    if (category.spentCents <= category.limitCents) within += 1;
  }

  return within / categories.length;
}

export type BudgetAlertLevel = "none" | "warn80" | "over100";

/**
 * Alerta em 80% e em 100% do teto (§5.1). A comparação de 80% é em inteiros
 * (`spent × 5 ≥ limit × 4`) para o limiar ser exato, sem float no caminho.
 * Teto ≤ 0 não tem "80% de zero": qualquer gasto positivo já é estouro.
 */
export function budgetAlertLevel(
  spentCents: Cents,
  limitCents: Cents,
): BudgetAlertLevel {
  if (limitCents <= 0) return spentCents > 0 ? "over100" : "none";
  if (spentCents >= limitCents) return "over100";
  if (spentCents * 5 >= limitCents * 4) return "warn80";

  return "none";
}

export type CategoryProgressInput = {
  spentCents: Cents;
  limitCents: Cents;
  /** Sobra do mês anterior que rola para este quando o rollover está ligado (padrão 0). */
  rolloverCents?: Cents;
};

export type CategoryProgress = {
  /** Teto do mês + rollover: é contra ele que gasto, alerta e fração se medem. */
  effectiveLimitCents: Cents;
  /** Quanto ainda cabe; negativo é o tamanho do estouro. */
  remainingCents: Cents;
  /**
   * Fração usada do teto efetivo (pode passar de 1 no estouro). Com teto
   * efetivo ≤ 0 a razão não existe: satura em 1 com gasto e 0 sem — o `alert`
   * carrega a informação real. Estorno líquido (gasto < 0) conta como 0.
   */
  usedFraction: number;
  alert: BudgetAlertLevel;
};

export function categoryProgress({
  spentCents,
  limitCents,
  rolloverCents = 0,
}: CategoryProgressInput): CategoryProgress {
  const effectiveLimitCents = limitCents + rolloverCents;
  const remainingCents = effectiveLimitCents - spentCents;

  let usedFraction: number;

  if (effectiveLimitCents > 0) {
    usedFraction = spentCents <= 0 ? 0 : spentCents / effectiveLimitCents;
  } else {
    usedFraction = spentCents > 0 ? 1 : 0;
  }

  return {
    effectiveLimitCents,
    remainingCents,
    usedFraction,
    alert: budgetAlertLevel(spentCents, effectiveLimitCents),
  };
}

/**
 * O que rola para o mês seguinte: só a sobra. Estouro não vira teto negativo
 * no mês novo — punir o mês seguinte pelo anterior transformaria um deslize em
 * espiral, e o alerta de 100% já fez o papel dele.
 */
export function monthLeftover(limitCents: Cents, spentCents: Cents): Cents {
  return Math.max(limitCents - spentCents, 0);
}
