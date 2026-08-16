import { describe, expect, it } from "vitest";

import { compareStrategies, payoffPlan, type DebtInput } from "@/lib/finance";

describe("payoffPlan — o cronograma mês a mês", () => {
  it("caso conferível à mão: 100,00 a 10% a.m. pagando 50,00/mês", () => {
    const plan = payoffPlan(
      [{ balanceCents: 10000, monthlyRateFraction: 0.1, minPaymentCents: 0 }],
      5000,
      "avalanche",
    );

    // m1: 10.000 + 1.000 − 5.000 = 6.000 · m2: 6.000 + 600 − 5.000 = 1.600
    // m3: 1.600 + 160 = 1.760, quitado com pagamento parcial.
    expect(plan.paidOff).toBe(true);
    expect(plan.totalMonths).toBe(3);
    expect(plan.totalInterestCents).toBe(1760);
    expect(plan.payoffMonthByDebt).toEqual([3]);
    expect(plan.firstPayoffMonth).toBe(3);
  });

  it("sem juros e sem extra, o mínimo quita no tempo exato", () => {
    const plan = payoffPlan(
      [
        {
          balanceCents: 100000,
          monthlyRateFraction: 0,
          minPaymentCents: 10000,
        },
      ],
      0,
      "snowball",
    );

    expect(plan.totalMonths).toBe(10);
    expect(plan.totalInterestCents).toBe(0);
  });

  it("mínimo liberado por dívida quitada rola para a próxima (cascata)", () => {
    const plan = payoffPlan(
      [
        { balanceCents: 1000, monthlyRateFraction: 0, minPaymentCents: 0 },
        { balanceCents: 1000, monthlyRateFraction: 0, minPaymentCents: 0 },
      ],
      1500,
      "snowball",
    );

    // m1: quita a 1ª (1.000) e o resto (500) já ataca a 2ª.
    expect(plan.payoffMonthByDebt).toEqual([1, 2]);
    expect(plan.firstPayoffMonth).toBe(1);
    expect(plan.totalMonths).toBe(2);
  });

  it("mínimo maior que o saldo paga só o saldo", () => {
    const plan = payoffPlan(
      [{ balanceCents: 5000, monthlyRateFraction: 0, minPaymentCents: 10000 }],
      0,
      "avalanche",
    );

    expect(plan.totalMonths).toBe(1);
  });

  it("dívida que já chega zerada marca mês 0, e o mínimo dela reforça o orçamento", () => {
    const plan = payoffPlan(
      [
        { balanceCents: 0, monthlyRateFraction: 0.05, minPaymentCents: 1000 },
        { balanceCents: 4000, monthlyRateFraction: 0, minPaymentCents: 1000 },
      ],
      0,
      "avalanche",
    );

    // O orçamento mensal é Σ mínimos + extra = 2.000: a dívida viva recebe
    // também o mínimo liberado pela que já nasceu quitada.
    expect(plan.payoffMonthByDebt).toEqual([0, 2]);
    expect(plan.firstPayoffMonth).toBe(2);
  });

  it("lista vazia já está quitada", () => {
    const plan = payoffPlan([], 10000, "snowball");

    expect(plan).toEqual({
      paidOff: true,
      totalMonths: 0,
      totalInterestCents: 0,
      payoffMonthByDebt: [],
      firstPayoffMonth: null,
    });
  });

  it("juros maiores que o pagamento: 'não quita', nunca loop infinito", () => {
    const plan = payoffPlan(
      [{ balanceCents: 10000, monthlyRateFraction: 0.5, minPaymentCents: 100 }],
      0,
      "avalanche",
    );

    expect(plan.paidOff).toBe(false);
    expect(plan.totalMonths).toBeNull();
    expect(plan.totalInterestCents).toBeNull();
    expect(plan.payoffMonthByDebt).toEqual([null]);
    expect(plan.firstPayoffMonth).toBeNull();
  });

  it("a dívida pequena quitada sobrevive no relatório mesmo quando o todo diverge", () => {
    const plan = payoffPlan(
      [
        { balanceCents: 100, monthlyRateFraction: 0, minPaymentCents: 100 },
        { balanceCents: 100000, monthlyRateFraction: 0.9, minPaymentCents: 0 },
      ],
      0,
      "snowball",
    );

    expect(plan.paidOff).toBe(false);
    expect(plan.payoffMonthByDebt).toEqual([1, null]);
    expect(plan.firstPayoffMonth).toBe(1);
  });

  it("progresso de formiga passa dos 100 anos e vira 'não quita'", () => {
    const plan = payoffPlan(
      [{ balanceCents: 2000, monthlyRateFraction: 0, minPaymentCents: 1 }],
      0,
      "avalanche",
    );

    expect(plan.paidOff).toBe(false);
    expect(plan.totalMonths).toBeNull();
  });

  it("recusa entradas sem sentido", () => {
    const debt: DebtInput = {
      balanceCents: 1000,
      monthlyRateFraction: 0.01,
      minPaymentCents: 100,
    };

    expect(() => payoffPlan([debt], -1, "avalanche")).toThrow(TypeError);
    expect(() => payoffPlan([debt], 10.5, "avalanche")).toThrow(TypeError);
    expect(() =>
      payoffPlan([{ ...debt, balanceCents: -1 }], 0, "avalanche"),
    ).toThrow(TypeError);
    expect(() =>
      payoffPlan([{ ...debt, minPaymentCents: -1 }], 0, "avalanche"),
    ).toThrow(TypeError);
    expect(() =>
      payoffPlan([{ ...debt, monthlyRateFraction: -0.1 }], 0, "avalanche"),
    ).toThrow(TypeError);
    expect(() =>
      payoffPlan(
        [{ ...debt, monthlyRateFraction: Number.NaN }],
        0,
        "avalanche",
      ),
    ).toThrow(TypeError);
  });
});

describe("compareStrategies — avalanche vs bola de neve lado a lado (§6.3)", () => {
  const debts: readonly DebtInput[] = [
    { balanceCents: 500000, monthlyRateFraction: 0.05, minPaymentCents: 15000 },
    { balanceCents: 80000, monthlyRateFraction: 0.02, minPaymentCents: 5000 },
  ];

  it("avalanche paga menos juros; bola de neve quita a primeira antes", () => {
    const { avalanche, snowball, avalancheSavingsCents } = compareStrategies(
      debts,
      20000,
    );

    expect(avalanche.paidOff).toBe(true);
    expect(snowball.paidOff).toBe(true);

    expect(avalanche.totalInterestCents!).toBeLessThan(
      snowball.totalInterestCents!,
    );
    expect(snowball.firstPayoffMonth!).toBeLessThan(
      avalanche.firstPayoffMonth!,
    );
    expect(avalancheSavingsCents).toBe(
      snowball.totalInterestCents! - avalanche.totalInterestCents!,
    );
    expect(avalancheSavingsCents!).toBeGreaterThan(0);
  });

  it("o avalanche ataca a taxa maior; o bola de neve, o saldo menor", () => {
    const { avalanche, snowball } = compareStrategies(debts, 20000);

    // Índice 0 tem a taxa maior; índice 1, o saldo menor.
    expect(avalanche.payoffMonthByDebt[0]!).toBeLessThan(
      snowball.payoffMonthByDebt[0]!,
    );
    expect(snowball.payoffMonthByDebt[1]!).toBeLessThan(
      avalanche.payoffMonthByDebt[1]!,
    );
  });

  it("quando nenhum método quita, a economia é null", () => {
    const comparison = compareStrategies(
      [{ balanceCents: 100000, monthlyRateFraction: 0.9, minPaymentCents: 0 }],
      1000,
    );

    expect(comparison.avalanche.paidOff).toBe(false);
    expect(comparison.snowball.paidOff).toBe(false);
    expect(comparison.avalancheSavingsCents).toBeNull();
  });
});
