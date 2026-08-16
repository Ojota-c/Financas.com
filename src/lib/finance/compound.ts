/**
 * Juros compostos e derivados (§6.3). Taxa entra como FRAÇÃO decimal
 * (0.10 = 10%), nunca em pontos percentuais — taxa não é dinheiro, então float
 * é aceitável no meio da conta; o resultado monetário arredonda para o centavo
 * uma única vez, na saída, e a regra de arredondamento está em cada função.
 */

import { assertCents, type Cents } from "./money";

function assertRate(rate: number, papel: string): void {
  if (!Number.isFinite(rate)) {
    throw new TypeError(`${papel} precisa ser número finito, veio ${rate}`);
  }

  // Juro de −100% ou além não descreve capitalização nenhuma: (1+i) ≤ 0
  // produziria potência sem sentido (zero ou sinal alternante).
  if (rate <= -1) {
    throw new RangeError(
      `${papel} precisa ser maior que −1 (−100%), veio ${rate}`,
    );
  }
}

function assertPeriods(periods: number, min: number): void {
  if (!Number.isInteger(periods) || periods < min) {
    throw new TypeError(
      `períodos precisa ser inteiro ≥ ${min}, veio ${periods}`,
    );
  }
}

/** FV = PV × (1 + i)^n, arredondado ao centavo com `Math.round`. */
export function futureValue(
  presentCents: Cents,
  ratePerPeriod: number,
  periods: number,
): Cents {
  assertCents(presentCents, "valor presente");
  assertRate(ratePerPeriod, "taxa por período");
  assertPeriods(periods, 0);

  const future = Math.round(presentCents * (1 + ratePerPeriod) ** periods);
  assertCents(future, "valor futuro");

  return future;
}

/**
 * Aporte por período para alcançar `targetCents`: FV × i / ((1+i)^n − 1).
 * Arredonda PARA CIMA (`Math.ceil`): aporte sugerido a menor deixa a meta
 * inalcançável por centavos — melhor sobrar que faltar. Com i = 0 a fórmula
 * degenera em 0/0; o limite matemático é FV ÷ n, e é o que vale.
 */
export function seriesContribution(
  targetCents: Cents,
  ratePerPeriod: number,
  periods: number,
): Cents {
  assertCents(targetCents, "valor alvo");
  assertRate(ratePerPeriod, "taxa por período");
  assertPeriods(periods, 1);

  const raw =
    ratePerPeriod === 0
      ? targetCents / periods
      : (targetCents * ratePerPeriod) / ((1 + ratePerPeriod) ** periods - 1);

  const contribution = Math.ceil(raw);
  assertCents(contribution, "aporte por período");

  return contribution;
}

/**
 * Regra de 72: anos para dobrar o capital à taxa anual dada (fração — 0.08,
 * não 8). Taxa ≤ 0 nunca dobra: `null`, nunca Infinity.
 */
export function ruleOf72(annualRateFraction: number): number | null {
  if (!Number.isFinite(annualRateFraction)) {
    throw new TypeError(
      `taxa anual precisa ser número finito, veio ${annualRateFraction}`,
    );
  }

  if (annualRateFraction <= 0) return null;

  // 72 / i% ≡ 0.72 / fração — a API do motor fala fração, então a constante muda.
  return 0.72 / annualRateFraction;
}

/**
 * Número da independência financeira: despesa ANUAL × 25 (regra dos 4%, §6.3).
 * Multiplicação exata de inteiros — sem arredondamento a documentar.
 */
export function financialIndependenceNumber(annualExpenseCents: Cents): Cents {
  assertCents(annualExpenseCents, "despesa anual");

  const target = annualExpenseCents * 25;
  assertCents(target, "número da independência");

  return target;
}

/**
 * Custo de oportunidade: valor × (1+i)^n − valor — o que o dinheiro gasto
 * teria virado se investido. Herda o arredondamento do `futureValue`.
 */
export function opportunityCost(
  valueCents: Cents,
  ratePerPeriod: number,
  periods: number,
): Cents {
  const cost = futureValue(valueCents, ratePerPeriod, periods) - valueCents;
  assertCents(cost, "custo de oportunidade");

  return cost;
}

/** Taxa efetiva mensal equivalente à anual: (1 + i_anual)^(1/12) − 1. Fração entra, fração sai. */
export function effectiveMonthlyRate(annualRateFraction: number): number {
  assertRate(annualRateFraction, "taxa anual");

  return (1 + annualRateFraction) ** (1 / 12) - 1;
}
