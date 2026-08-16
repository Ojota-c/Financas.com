import { describe, expect, it } from "vitest";

import { healthScore, type ScoreInput } from "@/lib/finance";

const base: ScoreInput = {
  incomeCents: 500000,
  expenseCents: 400000,
  reserveCents: 0,
  essentialMonthlyCents: 300000,
  debtMonthlyCents: 0,
  budgetAdherenceFraction: 1,
  positiveMonthsStreak: 0,
};

describe("healthScore — os 5 componentes do §5.2", () => {
  it("mês perfeito soma 100", () => {
    const score = healthScore({
      incomeCents: 500000,
      expenseCents: 0,
      reserveCents: 1800000, // 6 meses de essenciais
      essentialMonthlyCents: 300000,
      debtMonthlyCents: 0,
      budgetAdherenceFraction: 1,
      positiveMonthsStreak: 6,
    });

    expect(score.total).toBe(100);
  });

  it("tudo no chão soma 0", () => {
    const score = healthScore({
      incomeCents: 500000,
      expenseCents: 600000,
      reserveCents: 0,
      essentialMonthlyCents: 300000,
      debtMonthlyCents: 350000, // 70% da renda, acima do teto de 60%
      budgetAdherenceFraction: 0,
      positiveMonthsStreak: 0,
    });

    expect(score.total).toBe(0);
  });

  it("os pesos são 25/25/20/15/15", () => {
    const { components } = healthScore(base);

    expect(components.savingsRate.weight).toBe(25);
    expect(components.runway.weight).toBe(25);
    expect(components.debtLoad.weight).toBe(20);
    expect(components.budgetAdherence.weight).toBe(15);
    expect(components.consistency.weight).toBe(15);
  });

  it("poupança: (receita − despesa) ÷ receita, com meio do caminho", () => {
    const { components, total } = healthScore(base);

    // Poupa 20% → 5 pontos de 25. Runway 0, dívida plena, aderência plena.
    expect(components.savingsRate.ratio).toBeCloseTo(0.2, 10);
    expect(components.savingsRate.points).toBeCloseTo(5, 10);
    expect(total).toBe(40); // 5 + 0 + 20 + 15 + 0
  });

  it("runway satura em 6 meses — mais reserva não passa de 25 pontos", () => {
    const at6 = healthScore({ ...base, reserveCents: 1800000 });
    const at12 = healthScore({ ...base, reserveCents: 3600000 });
    const at3 = healthScore({ ...base, reserveCents: 900000 });

    expect(at6.components.runway.points).toBe(25);
    expect(at12.components.runway.points).toBe(25);
    expect(at3.components.runway.points).toBeCloseTo(12.5, 10);
  });

  it("sem despesa essencial conhecida: reserva positiva vale pleno, nenhuma vale zero", () => {
    expect(
      healthScore({ ...base, essentialMonthlyCents: 0, reserveCents: 1 })
        .components.runway.ratio,
    ).toBe(1);
    expect(
      healthScore({ ...base, essentialMonthlyCents: 0, reserveCents: 0 })
        .components.runway.ratio,
    ).toBe(0);
  });

  it("dívida: nota cheia até 30%, queda linear, zero em 60%", () => {
    expect(
      healthScore({ ...base, debtMonthlyCents: 150000 }).components.debtLoad
        .ratio,
    ).toBe(1); // 30%
    expect(
      healthScore({ ...base, debtMonthlyCents: 225000 }).components.debtLoad
        .ratio,
    ).toBeCloseTo(0.5, 10); // 45%
    expect(
      healthScore({ ...base, debtMonthlyCents: 300000 }).components.debtLoad
        .ratio,
    ).toBe(0); // 60%
  });

  it("renda zero não dá NaN: poupança 0, e dívida zera o componente só se existe dívida", () => {
    const noDebt = healthScore({
      ...base,
      incomeCents: 0,
      debtMonthlyCents: 0,
    });
    const inDebt = healthScore({
      ...base,
      incomeCents: 0,
      debtMonthlyCents: 1,
    });

    expect(noDebt.components.savingsRate.ratio).toBe(0);
    expect(noDebt.components.debtLoad.ratio).toBe(1);
    expect(inDebt.components.debtLoad.ratio).toBe(0);
    expect(Number.isNaN(noDebt.total)).toBe(false);
    expect(Number.isNaN(inDebt.total)).toBe(false);
  });

  it("consistência satura em 6 meses e não fica negativa", () => {
    expect(
      healthScore({ ...base, positiveMonthsStreak: 3 }).components.consistency
        .points,
    ).toBeCloseTo(7.5, 10);
    expect(
      healthScore({ ...base, positiveMonthsStreak: 24 }).components.consistency
        .ratio,
    ).toBe(1);
    expect(
      healthScore({ ...base, positiveMonthsStreak: -1 }).components.consistency
        .ratio,
    ).toBe(0);
  });

  it("aderência fora de 0–1 é clampada", () => {
    expect(
      healthScore({ ...base, budgetAdherenceFraction: 1.4 }).components
        .budgetAdherence.ratio,
    ).toBe(1);
    expect(
      healthScore({ ...base, budgetAdherenceFraction: -0.2 }).components
        .budgetAdherence.ratio,
    ).toBe(0);
  });

  it("o total arredonda uma única vez", () => {
    // Poupança 1/3 → 8,333… pontos; runway e streak 0; dívida 20; aderência 15.
    const score = healthScore({
      ...base,
      incomeCents: 300000,
      expenseCents: 200000,
    });

    expect(score.total).toBe(43); // round(8,333… + 0 + 20 + 15 + 0)
  });

  it("recusa aderência e streak que não são números finitos", () => {
    expect(() =>
      healthScore({ ...base, budgetAdherenceFraction: Number.NaN }),
    ).toThrow(TypeError);
    expect(() =>
      healthScore({ ...base, positiveMonthsStreak: Number.POSITIVE_INFINITY }),
    ).toThrow(TypeError);
  });

  it("recusa dinheiro fracionário em qualquer entrada", () => {
    expect(() => healthScore({ ...base, incomeCents: 10.5 })).toThrow(
      TypeError,
    );
  });
});
