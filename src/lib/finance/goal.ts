/**
 * Metas / cofrinhos (§5.1) e sinking funds (§6.2): aporte sugerido, data
 * projetada de conclusão no ritmo atual e a diluição de despesa anual certa
 * (IPVA, seguro, Natal) em aportes mensais que somam o valor exato.
 */

import { addMonthsClamped, parseIsoDate, type IsoDate } from "./civil-date";
import { allocate, assertCents, type Cents } from "./money";

// Meses são comparados por índice absoluto (ano × 12 + mês): a distância entre
// competências não depende do dia, e dezembro → janeiro sai de graça.
function monthIndexOf(date: IsoDate): number {
  const { year, month } = parseIsoDate(date);

  return year * 12 + (month - 1);
}

export type SuggestedContributionInput = {
  targetCents: Cents;
  savedCents: Cents;
  /** Prazo da meta; sem ele não existe "quanto por mês" a sugerir. */
  targetDate?: IsoDate;
  referenceDate: IsoDate;
};

/**
 * Aporte mensal sugerido: (alvo − guardado) ÷ meses restantes (§5.1), contando
 * o mês da referência E o do prazo — prazo no mês corrente é um aporte único.
 * Arredonda PARA CIMA em inteiros: sugerir a menor deixa a meta inalcançável
 * por centavos. Meta batida sugere 0; sem prazo devolve `null`; prazo já
 * vencido pede o que falta de uma vez (divisor 1, nunca zero).
 */
export function suggestedMonthlyContribution({
  targetCents,
  savedCents,
  targetDate,
  referenceDate,
}: SuggestedContributionInput): Cents | null {
  assertCents(targetCents, "alvo da meta");
  assertCents(savedCents, "total guardado");
  parseIsoDate(referenceDate);

  if (savedCents >= targetCents) return 0;
  if (targetDate === undefined) return null;

  const monthsRemaining = Math.max(
    monthIndexOf(targetDate) - monthIndexOf(referenceDate) + 1,
    1,
  );

  const missing = targetCents - savedCents;

  // Teto inteiro sem passar por float: (a + b − 1) ÷ b truncado.
  return Math.floor((missing + monthsRemaining - 1) / monthsRemaining);
}

export type GoalContribution = {
  date: IsoDate;
  amountCents: Cents;
};

export type ProjectedCompletionInput = {
  targetCents: Cents;
  savedCents: Cents;
  /** Histórico de aportes — o ritmo sai daqui, não de promessa. */
  contributions: readonly GoalContribution[];
  referenceDate: IsoDate;
};

/**
 * Data projetada de conclusão no ritmo atual (§5.1): ritmo = soma dos aportes
 * ÷ meses do histórico (do mês do primeiro aporte ao da referência,
 * inclusive — o divisor é sempre ≥ 1). Projeta `ceil(faltante ÷ ritmo)` meses
 * à frente da referência. Meta já batida conclui na própria referência; sem
 * histórico ou com ritmo ≤ 0 (só estornos) não há previsão: `null`.
 */
export function projectedCompletionDate({
  targetCents,
  savedCents,
  contributions,
  referenceDate,
}: ProjectedCompletionInput): IsoDate | null {
  assertCents(targetCents, "alvo da meta");
  assertCents(savedCents, "total guardado");
  const referenceMonth = monthIndexOf(referenceDate);

  if (savedCents >= targetCents) return referenceDate;
  if (contributions.length === 0) return null;

  let totalCents = 0;
  let firstMonth = referenceMonth;

  for (const contribution of contributions) {
    assertCents(contribution.amountCents, "aporte");
    totalCents += contribution.amountCents;
    firstMonth = Math.min(firstMonth, monthIndexOf(contribution.date));
  }

  if (totalCents <= 0) return null;

  const historyMonths = referenceMonth - firstMonth + 1;
  const monthlyPace = totalCents / historyMonths;
  const monthsToFinish = Math.ceil((targetCents - savedCents) / monthlyPace);

  return addMonthsClamped(referenceDate, monthsToFinish);
}

export type SinkingFundInput = {
  /** A despesa anual certa: IPVA, seguro, presente de Natal. */
  totalCents: Cents;
  /** Mês em que a conta chega. */
  targetDate: IsoDate;
  referenceDate: IsoDate;
};

export type SinkingFundInstallment = {
  date: IsoDate;
  amountCents: Cents;
};

/**
 * Sinking fund (§6.2): um aporte por mês, do mês da referência ao mês do alvo
 * (inclusive), ancorados no dia da referência. O rateio é o `allocate` do
 * money.ts, então a soma dos aportes é EXATAMENTE a despesa — R$ 1.800 de
 * IPVA em 12 vira 12 × R$ 150, sem centavo perdido. Alvo já no passado
 * degenera em aporte único na referência: a conta chegou, não há o que diluir.
 */
export function sinkingFundSchedule({
  totalCents,
  targetDate,
  referenceDate,
}: SinkingFundInput): SinkingFundInstallment[] {
  assertCents(totalCents, "despesa do sinking fund");

  const months = Math.max(
    monthIndexOf(targetDate) - monthIndexOf(referenceDate) + 1,
    1,
  );
  const amounts = allocate(totalCents, new Array<number>(months).fill(1));

  return amounts.map((amountCents, index) => ({
    date: addMonthsClamped(referenceDate, index),
    amountCents,
  }));
}
