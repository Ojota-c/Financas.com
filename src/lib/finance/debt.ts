/**
 * Quitação de dívida: avalanche vs bola de neve, calculados lado a lado (§6.3)
 * — "avalanche economiza R$ X · bola de neve quita a 1ª dívida em N meses".
 * O método que a pessoa mantém vence o método ótimo que ela abandona, então o
 * app entrega os dois números e deixa a escolha com ela.
 */

import { assertCents, type Cents } from "./money";

export type DebtInput = {
  balanceCents: Cents;
  /** Juro MENSAL como fração (0.12 = 12% a.m.). */
  monthlyRateFraction: number;
  minPaymentCents: Cents;
};

export type DebtStrategy = "avalanche" | "snowball";

export type DebtPayoffPlan = {
  /**
   * `false` quando o orçamento não vence os juros (ou a quitação passaria de
   * 100 anos): os totais ficam `null` em vez de um número mentiroso — e o
   * chamador mostra "não quita" em vez de loop infinito.
   */
  paidOff: boolean;
  totalMonths: number | null;
  totalInterestCents: Cents | null;
  /** Mês (1-based) em que cada dívida zera, alinhado por índice com a entrada; `null` = não quitou. Dívida que já chega zerada marca mês 0. */
  payoffMonthByDebt: readonly (number | null)[];
  /** Mês da primeira quitação entre as dívidas que tinham saldo — o número da motivação do bola de neve. Preenchido mesmo quando o todo não quita. */
  firstPayoffMonth: number | null;
};

// 100 anos. Progresso de 1 centavo/mês numa dívida grande escaparia da
// detecção de divergência e levaria milhões de iterações — acima disto é
// "não quita" na prática.
const MAX_MONTHS = 1200;

/**
 * Simula mês a mês: juros compostos sobre o saldo (arredondados ao centavo com
 * `Math.round`), mínimos de todas as dívidas vivas, e o restante do orçamento
 * — extra + mínimos liberados pelas já quitadas — em cascata na dívida-alvo da
 * estratégia. O orçamento mensal total é constante: `Σ mínimos + extra`.
 */
export function payoffPlan(
  debts: readonly DebtInput[],
  extraMonthlyCents: Cents,
  strategy: DebtStrategy,
): DebtPayoffPlan {
  assertCents(extraMonthlyCents, "orçamento extra");

  if (extraMonthlyCents < 0) {
    throw new TypeError(
      `orçamento extra não pode ser negativo, veio ${extraMonthlyCents}`,
    );
  }

  for (const debt of debts) {
    assertCents(debt.balanceCents, "saldo da dívida");
    assertCents(debt.minPaymentCents, "pagamento mínimo");

    if (debt.balanceCents < 0 || debt.minPaymentCents < 0) {
      throw new TypeError("saldo e pagamento mínimo não podem ser negativos");
    }

    if (
      !Number.isFinite(debt.monthlyRateFraction) ||
      debt.monthlyRateFraction < 0
    ) {
      throw new TypeError(
        `taxa mensal precisa ser fração ≥ 0, veio ${debt.monthlyRateFraction}`,
      );
    }
  }

  const balances = debts.map((debt) => debt.balanceCents);
  const payoffMonthByDebt: (number | null)[] = balances.map((balance) =>
    balance === 0 ? 0 : null,
  );

  const monthlyBudget =
    debts.reduce((acc, debt) => acc + debt.minPaymentCents, 0) +
    extraMonthlyCents;

  let totalInterestCents = 0;
  let month = 0;
  let diverged = false;

  while (balances.some((balance) => balance > 0)) {
    if (month === MAX_MONTHS) {
      diverged = true;
      break;
    }

    month += 1;
    const totalBefore = balances.reduce((acc, balance) => acc + balance, 0);

    // Juros do mês, dívida a dívida.
    for (let i = 0; i < balances.length; i += 1) {
      if (balances[i]! === 0) continue;

      const interest = Math.round(balances[i]! * debts[i]!.monthlyRateFraction);
      balances[i]! += interest;
      totalInterestCents += interest;
    }

    // Mínimos primeiro: são obrigação contratual, não escolha de estratégia.
    let pool = monthlyBudget;

    for (let i = 0; i < balances.length; i += 1) {
      const payment = Math.min(debts[i]!.minPaymentCents, balances[i]!);
      balances[i]! -= payment;
      pool -= payment;
    }

    // O alvo é reavaliado todo mês: no bola de neve os saldos mudam de ordem.
    // Empate mantém a ordem de entrada (sort estável) — determinístico.
    const order = balances
      .map((_, index) => index)
      .filter((index) => balances[index]! > 0)
      .sort((a, b) =>
        strategy === "avalanche"
          ? debts[b]!.monthlyRateFraction - debts[a]!.monthlyRateFraction
          : balances[a]! - balances[b]!,
      );

    for (const index of order) {
      if (pool === 0) break;

      const payment = Math.min(pool, balances[index]!);
      balances[index]! -= payment;
      pool -= payment;
    }

    for (let i = 0; i < balances.length; i += 1) {
      if (balances[i]! === 0 && payoffMonthByDebt[i] === null) {
        payoffMonthByDebt[i] = month;
      }
    }

    const totalAfter = balances.reduce((acc, balance) => acc + balance, 0);

    // Juros ≥ pagamentos e nada quitou: os saldos só crescem daqui em diante.
    if (totalAfter > 0 && totalAfter >= totalBefore) {
      diverged = true;
      break;
    }
  }

  const firstPaidMonths = payoffMonthByDebt.filter(
    (paidMonth): paidMonth is number => paidMonth !== null && paidMonth > 0,
  );
  const firstPayoffMonth =
    firstPaidMonths.length > 0 ? Math.min(...firstPaidMonths) : null;

  if (diverged) {
    return {
      paidOff: false,
      totalMonths: null,
      totalInterestCents: null,
      payoffMonthByDebt,
      firstPayoffMonth,
    };
  }

  assertCents(totalInterestCents, "juros totais");

  return {
    paidOff: true,
    totalMonths: month,
    totalInterestCents,
    payoffMonthByDebt,
    firstPayoffMonth,
  };
}

export type DebtStrategyComparison = {
  avalanche: DebtPayoffPlan;
  snowball: DebtPayoffPlan;
  /** Juros que o avalanche economiza sobre o bola de neve; `null` se algum dos dois não quita. */
  avalancheSavingsCents: Cents | null;
};

/** O comparativo do §6.3, pronto para a tela: os dois planos e a economia entre eles. */
export function compareStrategies(
  debts: readonly DebtInput[],
  extraMonthlyCents: Cents,
): DebtStrategyComparison {
  const avalanche = payoffPlan(debts, extraMonthlyCents, "avalanche");
  const snowball = payoffPlan(debts, extraMonthlyCents, "snowball");

  const avalancheSavingsCents =
    avalanche.paidOff && snowball.paidOff
      ? snowball.totalInterestCents! - avalanche.totalInterestCents!
      : null;

  return { avalanche, snowball, avalancheSavingsCents };
}
