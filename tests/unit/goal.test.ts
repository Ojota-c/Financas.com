import { describe, expect, it } from "vitest";

import {
  projectedCompletionDate,
  sinkingFundSchedule,
  suggestedMonthlyContribution,
  sumCents,
} from "@/lib/finance";

describe("suggestedMonthlyContribution — (alvo − guardado) ÷ meses restantes (§5.1)", () => {
  it("conta o mês da referência e o do prazo, inclusive", () => {
    // ago/2026 → jul/2027 = 12 aportes.
    expect(
      suggestedMonthlyContribution({
        targetCents: 100000,
        savedCents: 10000,
        targetDate: "2027-07-01",
        referenceDate: "2026-08-16",
      }),
    ).toBe(7500);
  });

  it("arredonda para cima: melhor sobrar centavo que faltar", () => {
    expect(
      suggestedMonthlyContribution({
        targetCents: 10000,
        savedCents: 0,
        targetDate: "2026-10-31",
        referenceDate: "2026-08-16",
      }),
    ).toBe(3334);
  });

  it("prazo no mês corrente é aporte único", () => {
    expect(
      suggestedMonthlyContribution({
        targetCents: 50000,
        savedCents: 20000,
        targetDate: "2026-08-31",
        referenceDate: "2026-08-16",
      }),
    ).toBe(30000);
  });

  it("prazo vencido pede o que falta de uma vez — nunca divisão por zero", () => {
    expect(
      suggestedMonthlyContribution({
        targetCents: 50000,
        savedCents: 20000,
        targetDate: "2026-05-31",
        referenceDate: "2026-08-16",
      }),
    ).toBe(30000);
  });

  it("meta já batida sugere 0, mesmo com prazo", () => {
    expect(
      suggestedMonthlyContribution({
        targetCents: 50000,
        savedCents: 50000,
        targetDate: "2027-01-01",
        referenceDate: "2026-08-16",
      }),
    ).toBe(0);
  });

  it("sem prazo não há 'quanto por mês': null", () => {
    expect(
      suggestedMonthlyContribution({
        targetCents: 50000,
        savedCents: 0,
        referenceDate: "2026-08-16",
      }),
    ).toBeNull();
  });

  it("recusa dinheiro fracionário", () => {
    expect(() =>
      suggestedMonthlyContribution({
        targetCents: 0.5,
        savedCents: 0,
        referenceDate: "2026-08-16",
      }),
    ).toThrow(TypeError);
  });
});

describe("projectedCompletionDate — quando fecha no ritmo atual", () => {
  it("ritmo = aportes ÷ meses do histórico; projeta ceil(faltante ÷ ritmo) meses", () => {
    // 3 aportes de 100,00 em jun–ago → ritmo 100,00/mês; faltam 300,00 → 3 meses.
    expect(
      projectedCompletionDate({
        targetCents: 100000,
        savedCents: 70000,
        contributions: [
          { date: "2026-06-01", amountCents: 10000 },
          { date: "2026-07-01", amountCents: 10000 },
          { date: "2026-08-01", amountCents: 10000 },
        ],
        referenceDate: "2026-08-16",
      }),
    ).toBe("2026-11-16");
  });

  it("mês do histórico sem aporte dilui o ritmo", () => {
    // 100,00 em maio, nada desde então: ritmo 25,00/mês → 4 meses para 100,00.
    expect(
      projectedCompletionDate({
        targetCents: 20000,
        savedCents: 10000,
        contributions: [{ date: "2026-05-10", amountCents: 10000 }],
        referenceDate: "2026-08-16",
      }),
    ).toBe("2026-12-16");
  });

  it("meta já batida conclui na própria referência", () => {
    expect(
      projectedCompletionDate({
        targetCents: 10000,
        savedCents: 10000,
        contributions: [],
        referenceDate: "2026-08-16",
      }),
    ).toBe("2026-08-16");
  });

  it("sem histórico não há ritmo: null", () => {
    expect(
      projectedCompletionDate({
        targetCents: 10000,
        savedCents: 0,
        contributions: [],
        referenceDate: "2026-08-16",
      }),
    ).toBeNull();
  });

  it("ritmo zero ou negativo (só estornos) não tem previsão: null", () => {
    expect(
      projectedCompletionDate({
        targetCents: 10000,
        savedCents: 0,
        contributions: [{ date: "2026-07-01", amountCents: -5000 }],
        referenceDate: "2026-08-16",
      }),
    ).toBeNull();
  });
});

describe("sinkingFundSchedule — a despesa anual diluída (§6.2)", () => {
  it("IPVA de 1.800,00 em 12 aportes de 150,00", () => {
    const schedule = sinkingFundSchedule({
      totalCents: 180000,
      targetDate: "2026-12-01",
      referenceDate: "2026-01-15",
    });

    expect(schedule).toHaveLength(12);
    expect(schedule.every((entry) => entry.amountCents === 15000)).toBe(true);
    expect(schedule[0]!.date).toBe("2026-01-15");
    expect(schedule[11]!.date).toBe("2026-12-15");
  });

  it("divisão inexata preserva a soma pelo maior resto", () => {
    const schedule = sinkingFundSchedule({
      totalCents: 100000,
      targetDate: "2026-10-01",
      referenceDate: "2026-08-16",
    });

    expect(schedule.map((entry) => entry.amountCents)).toEqual([
      33334, 33333, 33333,
    ]);
    expect(sumCents(schedule.map((entry) => entry.amountCents))).toBe(100000);
  });

  it("as datas clampam em mês curto sem perder a âncora", () => {
    const schedule = sinkingFundSchedule({
      totalCents: 30000,
      targetDate: "2026-03-01",
      referenceDate: "2026-01-31",
    });

    expect(schedule.map((entry) => entry.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("alvo já no passado degenera em aporte único na referência", () => {
    expect(
      sinkingFundSchedule({
        totalCents: 5000,
        targetDate: "2026-03-01",
        referenceDate: "2026-08-16",
      }),
    ).toEqual([{ date: "2026-08-16", amountCents: 5000 }]);
  });
});
