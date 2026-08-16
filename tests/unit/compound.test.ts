import { describe, expect, it } from "vitest";

import {
  effectiveMonthlyRate,
  financialIndependenceNumber,
  futureValue,
  opportunityCost,
  ruleOf72,
  seriesContribution,
} from "@/lib/finance";

const MAX = Number.MAX_SAFE_INTEGER;

describe("futureValue — FV = PV × (1 + i)^n", () => {
  it("capitaliza e arredonda ao centavo", () => {
    expect(futureValue(100000, 0.1, 2)).toBe(121000);
    // 1000,00 × 1,005^12 = 1061,6778… → 1061,68.
    expect(futureValue(100000, 0.005, 12)).toBe(106168);
  });

  it("zero períodos devolve o próprio valor", () => {
    expect(futureValue(123456, 0.1, 0)).toBe(123456);
  });

  it("taxa negativa (acima de −100%) derrete o valor", () => {
    expect(futureValue(100000, -0.5, 1)).toBe(50000);
  });

  it("recusa taxa que não é fração válida", () => {
    expect(() => futureValue(100, Number.NaN, 1)).toThrow(TypeError);
    expect(() => futureValue(100, -1, 1)).toThrow(RangeError);
  });

  it("recusa períodos fracionários ou negativos", () => {
    expect(() => futureValue(100, 0.1, -1)).toThrow(TypeError);
    expect(() => futureValue(100, 0.1, 1.5)).toThrow(TypeError);
  });

  it("recusa estourar a faixa segura em silêncio", () => {
    expect(() => futureValue(MAX, 1, 1)).toThrow(RangeError);
    expect(() => futureValue(100.5, 0.1, 1)).toThrow(TypeError);
  });
});

describe("seriesContribution — aporte para alcançar uma meta", () => {
  it("FV × i / ((1+i)^n − 1), arredondado PARA CIMA", () => {
    // 10.000,00 em 12 meses a 0,5% a.m. → 810,66399… → 810,67.
    expect(seriesContribution(1000000, 0.005, 12)).toBe(81067);
  });

  it("com taxa zero o limite é FV ÷ n — e sobra centavo, não falta", () => {
    expect(seriesContribution(10000, 0, 3)).toBe(3334);
    expect(seriesContribution(9000, 0, 3)).toBe(3000);
  });

  it("recusa série sem períodos", () => {
    expect(() => seriesContribution(10000, 0.01, 0)).toThrow(TypeError);
  });
});

describe("ruleOf72", () => {
  it("anos para dobrar: 72 ÷ taxa em % (a API fala fração)", () => {
    expect(ruleOf72(0.08)).toBeCloseTo(9, 10);
    expect(ruleOf72(0.12)).toBeCloseTo(6, 10);
  });

  it("taxa ≤ 0 nunca dobra: null, nunca Infinity", () => {
    expect(ruleOf72(0)).toBeNull();
    expect(ruleOf72(-0.05)).toBeNull();
  });

  it("recusa taxa que não é número", () => {
    expect(() => ruleOf72(Number.NaN)).toThrow(TypeError);
  });
});

describe("financialIndependenceNumber — regra dos 4%", () => {
  it("despesa anual × 25", () => {
    expect(financialIndependenceNumber(6000000)).toBe(150000000);
  });

  it("recusa estourar a faixa segura", () => {
    expect(() => financialIndependenceNumber(MAX)).toThrow(RangeError);
  });
});

describe("opportunityCost", () => {
  it("o que o gasto teria virado, menos o gasto", () => {
    expect(opportunityCost(100000, 0.1, 2)).toBe(21000);
  });

  it("sem juros não há custo", () => {
    expect(opportunityCost(100000, 0, 5)).toBe(0);
  });
});

describe("effectiveMonthlyRate", () => {
  it("(1 + anual)^(1/12) − 1 — juros compostos, não divisão por 12", () => {
    expect(effectiveMonthlyRate(0.12)).toBeCloseTo(0.00948879, 8);
    expect(effectiveMonthlyRate(0)).toBe(0);
  });

  it("recusa taxa de −100% ou além", () => {
    expect(() => effectiveMonthlyRate(-1)).toThrow(RangeError);
  });
});
