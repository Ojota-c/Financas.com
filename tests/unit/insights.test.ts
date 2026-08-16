import { describe, expect, it } from "vitest";

import {
  antExpenses,
  costInWorkHours,
  normalizeDescription,
  paretoConcentration,
  personalInflation,
  subscriptionRadar,
  type SubscriptionCharge,
} from "@/lib/finance";

describe("antExpenses — gastos formiga (§5.2)", () => {
  it("soma só o que é positivo e abaixo do limiar", () => {
    const summary = antExpenses(
      [2500, 1200, 3000, 15000, 0, -500],
      3000,
      300000,
    );

    expect(summary.totalCents).toBe(3700);
    expect(summary.count).toBe(2);
    expect(summary.incomeFraction).toBeCloseTo(3700 / 300000, 10);
  });

  it("renda zero não vira porcentagem: fração null", () => {
    expect(antExpenses([100], 3000, 0).incomeFraction).toBeNull();
  });

  it("lista vazia soma zero", () => {
    expect(antExpenses([], 3000, 100000)).toEqual({
      totalCents: 0,
      count: 0,
      incomeFraction: 0,
    });
  });

  it("recusa dinheiro fracionário", () => {
    expect(() => antExpenses([10.5], 3000, 0)).toThrow(TypeError);
    expect(() => antExpenses([], 30.5, 0)).toThrow(TypeError);
  });
});

describe("paretoConcentration — curva ABC", () => {
  it("conta quantas categorias concentram a fração-alvo", () => {
    const result = paretoConcentration(
      [
        { name: "moradia", totalCents: 50000 },
        { name: "mercado", totalCents: 30000 },
        { name: "lazer", totalCents: 15000 },
        { name: "outros", totalCents: 5000 },
      ],
      0.8,
    );

    expect(result.categoriesNeeded).toBe(2);
    expect(result.topCategories).toEqual(["moradia", "mercado"]);
    expect(result.totalCategories).toBe(4);
    expect(result.topShareFraction).toBeCloseTo(0.8, 10);
  });

  it("a fração-alvo padrão é 80% e a ordenação é por gasto, não por entrada", () => {
    const result = paretoConcentration([
      { name: "pequena", totalCents: 1000 },
      { name: "grande", totalCents: 99000 },
    ]);

    expect(result.categoriesNeeded).toBe(1);
    expect(result.topCategories).toEqual(["grande"]);
  });

  it("alvo 1 exige todas as categorias", () => {
    const result = paretoConcentration(
      [
        { name: "a", totalCents: 100 },
        { name: "b", totalCents: 100 },
      ],
      1,
    );

    expect(result.categoriesNeeded).toBe(2);
    expect(result.topShareFraction).toBe(1);
  });

  it("categoria com estorno líquido fica fora da conta", () => {
    const result = paretoConcentration([
      { name: "gasto", totalCents: 10000 },
      { name: "estorno", totalCents: -5000 },
      { name: "zerada", totalCents: 0 },
    ]);

    expect(result.totalCategories).toBe(1);
    expect(result.categoriesNeeded).toBe(1);
  });

  it("sem gasto positivo, tudo zera — nunca divisão por zero", () => {
    expect(paretoConcentration([])).toEqual({
      categoriesNeeded: 0,
      topCategories: [],
      totalCategories: 0,
      topShareFraction: 0,
    });
  });

  it("recusa fração-alvo fora de (0, 1]", () => {
    expect(() => paretoConcentration([], 0)).toThrow(TypeError);
    expect(() => paretoConcentration([], 1.1)).toThrow(TypeError);
    expect(() => paretoConcentration([], Number.NaN)).toThrow(TypeError);
  });
});

describe("normalizeDescription", () => {
  it("minúsculas, sem acento, sem dígito e sem pontuação", () => {
    expect(normalizeDescription("PAG*NETFLIX 04/12")).toBe("pag netflix");
    expect(normalizeDescription("PAG*NETFLIX 05/12")).toBe("pag netflix");
    expect(normalizeDescription("Açaí do Zé  ")).toBe("acai do ze");
  });

  it("descrição só de ruído vira vazio", () => {
    expect(normalizeDescription("1234 **")).toBe("");
  });
});

const charge = (
  description: string,
  amountCents: number,
  date: string,
): SubscriptionCharge => ({ description, amountCents, date });

describe("subscriptionRadar (§5.2)", () => {
  it("detecta valor igual em meses consecutivos e anualiza o custo", () => {
    const detected = subscriptionRadar([
      charge("NETFLIX.COM 01/01", 3990, "2026-05-10"),
      charge("NETFLIX.COM 02/02", 3990, "2026-06-10"),
      charge("NETFLIX.COM 03/03", 3990, "2026-07-10"),
      charge("PADARIA DO ZÉ", 1550, "2026-07-12"), // uma vez só: não é assinatura
    ]);

    expect(detected).toEqual([
      {
        normalizedDescription: "netflix com",
        lastAmountCents: 3990,
        annualizedCents: 47880,
        consecutiveMonths: 3,
        priceIncreased: false,
      },
    ]);
  });

  it("sinaliza aumento de preço dentro da tolerância", () => {
    const detected = subscriptionRadar([
      charge("SPOTIFY", 2190, "2026-05-05"),
      charge("SPOTIFY", 2190, "2026-06-05"),
      charge("SPOTIFY", 2390, "2026-07-05"), // +9,1%, dentro dos 10%
    ]);

    expect(detected[0]!.priceIncreased).toBe(true);
    expect(detected[0]!.lastAmountCents).toBe(2390);
    expect(detected[0]!.annualizedCents).toBe(28680);
  });

  it("variação acima da tolerância quebra a sequência", () => {
    const detected = subscriptionRadar([
      charge("ACADEMIA", 10000, "2026-05-01"),
      charge("ACADEMIA", 10000, "2026-06-01"),
      charge("ACADEMIA", 15000, "2026-07-01"), // +50%: outra coisa
    ]);

    expect(detected).toEqual([]);
  });

  it("mês sem cobrança quebra a sequência — só o trecho mais recente conta", () => {
    const charges = [
      charge("ICLOUD", 490, "2026-01-03"),
      charge("ICLOUD", 490, "2026-02-03"),
      charge("ICLOUD", 490, "2026-04-03"),
      charge("ICLOUD", 490, "2026-05-03"),
    ];

    expect(subscriptionRadar(charges)).toEqual([]);
    expect(
      subscriptionRadar(charges, { minConsecutiveMonths: 2 })[0]!
        .consecutiveMonths,
    ).toBe(2);
  });

  it("dezembro → janeiro é consecutivo", () => {
    const detected = subscriptionRadar([
      charge("PRIME", 1490, "2026-11-15"),
      charge("PRIME", 1490, "2026-12-15"),
      charge("PRIME", 1490, "2027-01-15"),
    ]);

    expect(detected[0]!.consecutiveMonths).toBe(3);
  });

  it("duas cobranças no mesmo mês: vale a mais recente", () => {
    const detected = subscriptionRadar([
      charge("STREAMING", 2000, "2026-05-20"),
      charge("STREAMING", 2000, "2026-06-20"),
      charge("STREAMING", 2000, "2026-07-20"),
      charge("STREAMING", 999999, "2026-07-01"), // ajuste antigo, ignorado
    ]);

    expect(detected[0]!.lastAmountCents).toBe(2000);
  });

  it("estorno, zero e descrição só de ruído ficam de fora", () => {
    expect(
      subscriptionRadar([
        charge("SUB", -3990, "2026-05-10"),
        charge("SUB", 0, "2026-06-10"),
        charge("123456", 3990, "2026-07-10"),
      ]),
    ).toEqual([]);
  });

  it("ordena pelo custo anualizado, com desempate estável pelo nome", () => {
    const detected = subscriptionRadar(
      [
        charge("BARATA", 1000, "2026-05-01"),
        charge("BARATA", 1000, "2026-06-01"),
        charge("CARA", 5000, "2026-05-01"),
        charge("CARA", 5000, "2026-06-01"),
        charge("ABACATE", 1000, "2026-05-01"),
        charge("ABACATE", 1000, "2026-06-01"),
      ],
      { minConsecutiveMonths: 2, toleranceFraction: 0.1 },
    );

    expect(detected.map((sub) => sub.normalizedDescription)).toEqual([
      "cara",
      "abacate",
      "barata",
    ]);
  });

  it("recusa opções sem sentido", () => {
    expect(() => subscriptionRadar([], { toleranceFraction: -0.1 })).toThrow(
      TypeError,
    );
    expect(() =>
      subscriptionRadar([], { toleranceFraction: Number.NaN }),
    ).toThrow(TypeError);
    expect(() => subscriptionRadar([], { minConsecutiveMonths: 1 })).toThrow(
      TypeError,
    );
    expect(() => subscriptionRadar([], { minConsecutiveMonths: 2.5 })).toThrow(
      TypeError,
    );
  });
});

describe("personalInflation — sua cesta contra a do ano passado", () => {
  it("(atual ÷ anterior) − 1, como fração", () => {
    expect(personalInflation(109200, 100000)).toBeCloseTo(0.092, 10);
    expect(personalInflation(95000, 100000)).toBeCloseTo(-0.05, 10);
  });

  it("sem cesta anterior positiva não há base: null", () => {
    expect(personalInflation(100000, 0)).toBeNull();
    expect(personalInflation(100000, -100)).toBeNull();
  });
});

describe("costInWorkHours — o reenquadramento em horas", () => {
  it("valor ÷ (salário ÷ horas do mês)", () => {
    // R$ 300 com salário de R$ 3.500 por 100h → valor-hora R$ 35 → ≈ 8,57h.
    expect(costInWorkHours(30000, 350000, 100)).toBeCloseTo(8.571428, 5);
  });

  it("salário ou carga horária inválidos: null, nunca Infinity", () => {
    expect(costInWorkHours(30000, 0, 160)).toBeNull();
    expect(costInWorkHours(30000, 350000, 0)).toBeNull();
  });

  it("recusa horas que não são número finito", () => {
    expect(() => costInWorkHours(30000, 350000, Number.NaN)).toThrow(TypeError);
  });
});
