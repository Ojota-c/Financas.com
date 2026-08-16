import { describe, expect, it } from "vitest";

import {
  budgetAdherence,
  budgetAlertLevel,
  categoryProgress,
  DEFAULT_BUCKET_WEIGHTS,
  monthLeftover,
  splitByBuckets,
  sumCents,
} from "@/lib/finance";

describe("splitByBuckets — 50/30/20 que preserva a soma", () => {
  it("divide pelos pesos padrão", () => {
    expect(splitByBuckets(500000)).toEqual({
      needs: 250000,
      wants: 150000,
      savings: 100000,
    });
  });

  it("nunca perde centavo, mesmo quando a divisão não é exata", () => {
    const parts = splitByBuckets(10001);

    expect(sumCents([parts.needs, parts.wants, parts.savings])).toBe(10001);
  });

  it("aceita pesos ajustados — 70/20/10 do §6.2", () => {
    expect(
      splitByBuckets(100000, { needs: 70, wants: 10, savings: 20 }),
    ).toEqual({
      needs: 70000,
      wants: 10000,
      savings: 20000,
    });
  });

  it("os pesos padrão são 50/30/20", () => {
    expect(DEFAULT_BUCKET_WEIGHTS).toEqual({
      needs: 50,
      wants: 30,
      savings: 20,
    });
  });
});

describe("budgetAdherence", () => {
  it("é a fração de categorias dentro do teto", () => {
    expect(
      budgetAdherence([
        { spentCents: 8000, limitCents: 10000 },
        { spentCents: 10000, limitCents: 10000 },
        { spentCents: 12000, limitCents: 10000 },
        { spentCents: 0, limitCents: 5000 },
      ]),
    ).toBe(0.75);
  });

  it("sem categoria orçada, aderência é 1 — nunca NaN", () => {
    expect(budgetAdherence([])).toBe(1);
  });
});

describe("budgetAlertLevel — os degraus de 80% e 100%", () => {
  it("abaixo de 80% não alerta", () => {
    expect(budgetAlertLevel(7999, 10000)).toBe("none");
  });

  it("80% exatos já avisam — o limiar é fechado", () => {
    expect(budgetAlertLevel(8000, 10000)).toBe("warn80");
    expect(budgetAlertLevel(9999, 10000)).toBe("warn80");
  });

  it("100% ou mais é estouro", () => {
    expect(budgetAlertLevel(10000, 10000)).toBe("over100");
    expect(budgetAlertLevel(15000, 10000)).toBe("over100");
  });

  it("teto zero: qualquer gasto positivo é estouro, nenhum gasto é silêncio", () => {
    expect(budgetAlertLevel(1, 0)).toBe("over100");
    expect(budgetAlertLevel(0, 0)).toBe("none");
    expect(budgetAlertLevel(0, -1000)).toBe("none");
  });
});

describe("categoryProgress — progresso com rollover", () => {
  it("a sobra do mês anterior soma ao teto", () => {
    const progress = categoryProgress({
      spentCents: 9000,
      limitCents: 10000,
      rolloverCents: 8000,
    });

    expect(progress.effectiveLimitCents).toBe(18000);
    expect(progress.remainingCents).toBe(9000);
    expect(progress.usedFraction).toBe(0.5);
    expect(progress.alert).toBe("none");
  });

  it("sem rollover informado, vale só o teto do mês", () => {
    const progress = categoryProgress({ spentCents: 12000, limitCents: 10000 });

    expect(progress.effectiveLimitCents).toBe(10000);
    expect(progress.remainingCents).toBe(-2000);
    expect(progress.usedFraction).toBe(1.2);
    expect(progress.alert).toBe("over100");
  });

  it("estorno líquido conta como fração 0", () => {
    expect(
      categoryProgress({ spentCents: -500, limitCents: 10000 }).usedFraction,
    ).toBe(0);
  });

  it("teto efetivo zero satura a fração e deixa a informação com o alerta", () => {
    const overspent = categoryProgress({ spentCents: 100, limitCents: 0 });
    const untouched = categoryProgress({ spentCents: 0, limitCents: 0 });

    expect(overspent.usedFraction).toBe(1);
    expect(overspent.alert).toBe("over100");
    expect(untouched.usedFraction).toBe(0);
    expect(untouched.alert).toBe("none");
  });
});

describe("monthLeftover — o que rola para o mês seguinte", () => {
  it("sobra positiva rola", () => {
    expect(monthLeftover(10000, 2000)).toBe(8000);
  });

  it("estouro não rola negativo", () => {
    expect(monthLeftover(10000, 12000)).toBe(0);
  });
});
