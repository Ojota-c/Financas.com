/**
 * Score de Saúde Financeira 0–100 (§5.2): cinco componentes com pesos fixos
 * — poupança 25 · runway 25 · dívida 20 · aderência 15 · consistência 15.
 * O detalhamento por componente é parte do contrato: o gauge abre ao toque.
 */

import { assertCents, type Cents } from "./money";

export type ScoreInput = {
  /** Renda do mês. */
  incomeCents: Cents;
  /** Despesa total do mês. */
  expenseCents: Cents;
  /** Reserva líquida disponível. */
  reserveCents: Cents;
  /** Média mensal de despesas essenciais (base do runway). */
  essentialMonthlyCents: Cents;
  /** Parcelas de dívida do mês. */
  debtMonthlyCents: Cents;
  /** Aderência ao orçamento como fração 0–1 (sai de `budgetAdherence`). */
  budgetAdherenceFraction: number;
  /** Meses seguidos fechados no positivo. */
  positiveMonthsStreak: number;
};

export type ScoreComponent = {
  /** Peso no total (os cinco somam 100). */
  weight: number;
  /** Nota crua 0–1, antes do peso. */
  ratio: number;
  /** Pontos levados ao total: `ratio × weight`, sem arredondar. */
  points: number;
};

export type HealthScore = {
  /**
   * 0–100 inteiro. Arredondado UMA vez, no total — arredondar componente por
   * componente acumularia até 2,5 pontos de erro e o detalhamento não somaria
   * o que o gauge mostra.
   */
  total: number;
  components: {
    savingsRate: ScoreComponent;
    runway: ScoreComponent;
    debtLoad: ScoreComponent;
    budgetAdherence: ScoreComponent;
    consistency: ScoreComponent;
  };
};

/** Runway "cheio" do §5.2: 6 meses de essenciais valem os 25 pontos. */
const RUNWAY_TARGET_MONTHS = 6;

/** Comprometimento ideal (< 30% da renda) e o teto onde a nota zera (60%). */
const DEBT_IDEAL_FRACTION = 0.3;
const DEBT_CEILING_FRACTION = 0.6;

/**
 * Consistência satura em 6 meses — mesma régua do runway: meio ano seguido no
 * azul é hábito consolidado, e acima disso o score viraria fotografia do
 * passado em vez de retrato do presente.
 */
const CONSISTENCY_TARGET_MONTHS = 6;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;

  return value;
}

function component(weight: number, ratio: number): ScoreComponent {
  return { weight, ratio, points: ratio * weight };
}

/**
 * Renda zero é caso real (mês sem receita), não erro: nenhuma divisão por ela
 * acontece. Sem renda, a taxa de poupança é 0 (não há o que poupar) e qualquer
 * parcela de dívida compromete tudo — dívida sem renda zera o componente.
 */
export function healthScore(input: ScoreInput): HealthScore {
  const {
    incomeCents,
    expenseCents,
    reserveCents,
    essentialMonthlyCents,
    debtMonthlyCents,
    budgetAdherenceFraction,
    positiveMonthsStreak,
  } = input;

  assertCents(incomeCents, "renda do mês");
  assertCents(expenseCents, "despesa do mês");
  assertCents(reserveCents, "reserva líquida");
  assertCents(essentialMonthlyCents, "despesa essencial mensal");
  assertCents(debtMonthlyCents, "parcelas de dívida");

  if (!Number.isFinite(budgetAdherenceFraction)) {
    throw new TypeError(
      `aderência precisa ser fração finita, veio ${budgetAdherenceFraction}`,
    );
  }

  if (!Number.isFinite(positiveMonthsStreak)) {
    throw new TypeError(
      `streak precisa ser número finito, veio ${positiveMonthsStreak}`,
    );
  }

  const savingsRatio =
    incomeCents <= 0 ? 0 : clamp01((incomeCents - expenseCents) / incomeCents);

  // Sem despesa essencial conhecida não existe razão a calcular: com alguma
  // reserva o componente é pleno, sem nenhuma é zero — nunca NaN.
  let runwayRatio: number;

  if (essentialMonthlyCents <= 0) {
    runwayRatio = reserveCents > 0 ? 1 : 0;
  } else {
    runwayRatio = clamp01(
      reserveCents / essentialMonthlyCents / RUNWAY_TARGET_MONTHS,
    );
  }

  let debtRatio: number;

  if (incomeCents <= 0) {
    debtRatio = debtMonthlyCents > 0 ? 0 : 1;
  } else {
    const commitment = debtMonthlyCents / incomeCents;

    // Nota cheia até 30% e queda linear até zerar em 60%: passar de 30% é
    // gradiente, não penhasco — 31% não pode valer o mesmo que 60%.
    debtRatio =
      commitment <= DEBT_IDEAL_FRACTION
        ? 1
        : clamp01(
            (DEBT_CEILING_FRACTION - commitment) /
              (DEBT_CEILING_FRACTION - DEBT_IDEAL_FRACTION),
          );
  }

  const components = {
    savingsRate: component(25, savingsRatio),
    runway: component(25, runwayRatio),
    debtLoad: component(20, debtRatio),
    budgetAdherence: component(15, clamp01(budgetAdherenceFraction)),
    consistency: component(
      15,
      clamp01(positiveMonthsStreak / CONSISTENCY_TARGET_MONTHS),
    ),
  };

  const total = Math.round(
    components.savingsRate.points +
      components.runway.points +
      components.debtLoad.points +
      components.budgetAdherence.points +
      components.consistency.points,
  );

  return { total, components };
}
