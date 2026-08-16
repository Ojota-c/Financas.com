import { describe, expect, it } from "vitest";

import {
  projectMonthEndExpense,
  runwayMonths,
  safeToSpend,
} from "@/lib/finance";

describe("safeToSpend — o número herói do dashboard (§5.2)", () => {
  it("disponível = saldo − pendentes − metas; por dia inclui hoje", () => {
    // 16/08 num mês de 31 dias: restam 16 dias, contando o próprio dia 16.
    const result = safeToSpend({
      balanceCents: 500000,
      pendingCents: 200000,
      goalContributionsCents: 100000,
      referenceDate: "2026-08-16",
    });

    expect(result.availableCents).toBe(200000);
    expect(result.daysRemaining).toBe(16);
    expect(result.perDayCents).toBe(12500);
  });

  it("no último dia do mês o divisor é 1, nunca zero", () => {
    const result = safeToSpend({
      balanceCents: 8700,
      pendingCents: 0,
      goalContributionsCents: 0,
      referenceDate: "2026-02-28",
    });

    expect(result.daysRemaining).toBe(1);
    expect(result.perDayCents).toBe(8700);
  });

  it("arredonda para baixo: nunca promete centavo que não existe", () => {
    const result = safeToSpend({
      balanceCents: 100,
      pendingCents: 0,
      goalContributionsCents: 0,
      referenceDate: "2026-08-29", // 3 dias restantes
    });

    expect(result.perDayCents).toBe(33);
  });

  it("disponível negativo fica negativo — e o floor puxa para o lado conservador", () => {
    const result = safeToSpend({
      balanceCents: 0,
      pendingCents: 100,
      goalContributionsCents: 0,
      referenceDate: "2026-08-29",
    });

    expect(result.availableCents).toBe(-100);
    expect(result.perDayCents).toBe(-34);
  });

  it("recusa dinheiro fracionário", () => {
    expect(() =>
      safeToSpend({
        balanceCents: 10.5,
        pendingCents: 0,
        goalContributionsCents: 0,
        referenceDate: "2026-08-16",
      }),
    ).toThrow(TypeError);
  });
});

describe("projectMonthEndExpense — a projeção que chega no dia 12, não no 30", () => {
  it("extrapola o ritmo e soma os recorrentes restantes", () => {
    // Dia 12 de agosto (31 dias): ritmo 10.000/dia → 19 dias × 10.000 = 190.000.
    expect(
      projectMonthEndExpense({
        spentCents: 120000,
        remainingRecurringCents: 50000,
        referenceDate: "2026-08-12",
      }),
    ).toBe(360000);
  });

  it("no dia 1 o ritmo é o gasto do próprio dia — sem divisão por zero", () => {
    expect(
      projectMonthEndExpense({
        spentCents: 3000,
        remainingRecurringCents: 0,
        referenceDate: "2026-02-01",
      }),
    ).toBe(3000 + 3000 * 27);
  });

  it("no último dia não há o que extrapolar", () => {
    expect(
      projectMonthEndExpense({
        spentCents: 250000,
        remainingRecurringCents: 7000,
        referenceDate: "2026-08-31",
      }),
    ).toBe(257000);
  });

  it("arredonda a extrapolação uma única vez, para o centavo", () => {
    // 100 × 28 ÷ 3 = 933,33… → 933.
    expect(
      projectMonthEndExpense({
        spentCents: 100,
        remainingRecurringCents: 0,
        referenceDate: "2026-08-03",
      }),
    ).toBe(1033);
  });

  it("recusa dinheiro fracionário", () => {
    expect(() =>
      projectMonthEndExpense({
        spentCents: 0.5,
        remainingRecurringCents: 0,
        referenceDate: "2026-08-12",
      }),
    ).toThrow(TypeError);
  });
});

describe("runwayMonths — meses de sobrevivência com uma casa decimal", () => {
  it("reserva ÷ essenciais, em décimos de mês", () => {
    expect(runwayMonths(1260000, 300000)).toBe(4.2);
    expect(runwayMonths(1800000, 300000)).toBe(6);
  });

  it("arredonda o décimo mais próximo", () => {
    expect(runwayMonths(1000000, 300000)).toBe(3.3); // 3,333…
    expect(runwayMonths(1100000, 300000)).toBe(3.7); // 3,666…
  });

  it("sem despesa essencial conhecida devolve null, nunca Infinity", () => {
    expect(runwayMonths(1000000, 0)).toBeNull();
    expect(runwayMonths(1000000, -1)).toBeNull();
  });

  it("reserva zerada ou negativa é runway 0", () => {
    expect(runwayMonths(0, 300000)).toBe(0);
    expect(runwayMonths(-5000, 300000)).toBe(0);
  });
});
