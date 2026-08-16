/**
 * Previsões do mês: safe-to-spend (§5.2, o número herói), projeção de fim de
 * mês e runway. A data de referência é sempre parâmetro — o "hoje" é de quem
 * chama, nunca daqui.
 */

import { daysInMonth, parseIsoDate, type IsoDate } from "./civil-date";
import { assertCents, type Cents } from "./money";

export type SafeToSpendInput = {
  balanceCents: Cents;
  /** Contas a pagar conhecidas até o fim do mês. */
  pendingCents: Cents;
  /** Aportes de meta planejados para o mês. */
  goalContributionsCents: Cents;
  referenceDate: IsoDate;
};

export type SafeToSpend = {
  /** saldo − pendentes − aportes de meta. Pode ser negativo. */
  availableCents: Cents;
  /**
   * Disponível por dia até o fim do mês, contando o dia da referência.
   * Divisão inteira com `Math.floor`: nunca promete um centavo que não existe,
   * e no negativo o floor é o lado conservador (pior, não melhor).
   */
  perDayCents: Cents;
  /** Dias restantes no mês, incluindo hoje — nunca zero. */
  daysRemaining: number;
};

export function safeToSpend({
  balanceCents,
  pendingCents,
  goalContributionsCents,
  referenceDate,
}: SafeToSpendInput): SafeToSpend {
  assertCents(balanceCents, "saldo");
  assertCents(pendingCents, "pendentes do mês");
  assertCents(goalContributionsCents, "aportes de meta");

  const { year, month, day } = parseIsoDate(referenceDate);

  // `parseIsoDate` garante day ≤ daysInMonth, então o divisor é sempre ≥ 1.
  const daysRemaining = daysInMonth(year, month) - day + 1;
  const availableCents = balanceCents - pendingCents - goalContributionsCents;

  return {
    availableCents,
    perDayCents: Math.floor(availableCents / daysRemaining),
    daysRemaining,
  };
}

export type MonthEndProjectionInput = {
  /** Gasto acumulado do mês até a data de referência (recorrentes já pagos inclusos). */
  spentCents: Cents;
  /** Recorrentes conhecidos que ainda caem até o fim do mês — entram por inteiro, não pelo ritmo. */
  remainingRecurringCents: Cents;
  referenceDate: IsoDate;
};

/**
 * Projeção de fim de mês (§5.2): o ritmo diário observado até a referência,
 * extrapolado para os dias restantes, mais os recorrentes ainda por cair.
 * O dia da referência conta como decorrido, então o divisor nunca é zero — no
 * dia 1 o ritmo é o gasto do próprio dia. A extrapolação multiplica antes de
 * dividir, em inteiros, e arredonda uma única vez.
 */
export function projectMonthEndExpense({
  spentCents,
  remainingRecurringCents,
  referenceDate,
}: MonthEndProjectionInput): Cents {
  assertCents(spentCents, "gasto acumulado");
  assertCents(remainingRecurringCents, "recorrentes restantes");

  const { year, month, day } = parseIsoDate(referenceDate);
  const remainingDays = daysInMonth(year, month) - day;
  const paceCents = Math.round((spentCents * remainingDays) / day);

  const projected = spentCents + paceCents + remainingRecurringCents;
  assertCents(projected, "projeção de fim de mês");

  return projected;
}

/**
 * Runway em meses com UMA casa decimal — "aguenta 4,2 meses" (§5.2). O décimo
 * de mês é o grão da mensagem; mais precisão seria falsa precisão.
 *
 * Sem despesa essencial conhecida (≤ 0) não existe razão a calcular: devolve
 * `null`, nunca Infinity. Reserva ≤ 0 é runway 0 — negativo não significa nada.
 */
export function runwayMonths(
  reserveCents: Cents,
  essentialMonthlyCents: Cents,
): number | null {
  assertCents(reserveCents, "reserva líquida");
  assertCents(essentialMonthlyCents, "despesa essencial mensal");

  if (essentialMonthlyCents <= 0) return null;
  if (reserveCents <= 0) return 0;

  return Math.round((reserveCents / essentialMonthlyCents) * 10) / 10;
}
