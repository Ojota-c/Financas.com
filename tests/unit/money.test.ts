import { describe, expect, it } from "vitest";

import {
  allocate,
  formatCents,
  parseCents,
  parseMoneyInput,
  sumCents,
} from "@/lib/finance";

const MAX = Number.MAX_SAFE_INTEGER;

describe("parseCents — a borda de entrada do banco", () => {
  it("aceita o inteiro que já veio como number", () => {
    expect(parseCents(123456)).toBe(123456);
    expect(parseCents(0)).toBe(0);
    expect(parseCents(-500)).toBe(-500);
  });

  it("converte a string que o driver pg devolve para BIGINT", () => {
    expect(parseCents("123456")).toBe(123456);
    expect(parseCents("-42")).toBe(-42);
    expect(parseCents("+42")).toBe(42);
    expect(parseCents("  789  ")).toBe(789);
  });

  it("recusa number fracionário — é o sintoma de float em caminho de dinheiro", () => {
    expect(() => parseCents(10.5)).toThrow(TypeError);
    expect(() => parseCents(Number.NaN)).toThrow(TypeError);
  });

  it("recusa o que o Number() aceitaria em silêncio", () => {
    expect(() => parseCents("")).toThrow(TypeError);
    expect(() => parseCents("0x10")).toThrow(TypeError);
    expect(() => parseCents("12.5")).toThrow(TypeError);
    expect(() => parseCents("mil")).toThrow(TypeError);
  });

  it("recusa BIGINT que não caberia no double, em vez de arredondar calado", () => {
    expect(() => parseCents("9007199254740993")).toThrow(RangeError);
    expect(() => parseCents(MAX + 2)).toThrow(RangeError);
  });
});

describe("parseMoneyInput — a borda de entrada do usuário", () => {
  it("lê o formato que a pessoa digita em pt-BR", () => {
    expect(parseMoneyInput("1.234,56")).toBe(123456);
    expect(parseMoneyInput("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyInput("1234,56")).toBe(123456);
    expect(parseMoneyInput("  99,90 ")).toBe(9990);
  });

  it("completa a casa faltante em vez de ler dez vezes menos", () => {
    expect(parseMoneyInput("10,5")).toBe(1050);
    expect(parseMoneyInput("1.5")).toBe(150);
  });

  it("trata separador seguido de três dígitos como milhar", () => {
    expect(parseMoneyInput("1.234")).toBe(123400);
    expect(parseMoneyInput("1.234.567")).toBe(123456700);
  });

  it("sem separador nenhum, o número é de reais inteiros", () => {
    expect(parseMoneyInput("1234")).toBe(123400);
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("aceita valor que começa pelos centavos", () => {
    expect(parseMoneyInput(",50")).toBe(50);
  });

  it("carrega o sinal", () => {
    expect(parseMoneyInput("-1.234,56")).toBe(-123456);
    expect(parseMoneyInput("+10,00")).toBe(1000);
  });

  it("devolve null no que não é número, para o Zod dar a mensagem", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("R$")).toBeNull();
    expect(parseMoneyInput(",")).toBeNull();
    expect(parseMoneyInput("12a4")).toBeNull();
  });

  it("devolve null no que estouraria a faixa segura", () => {
    expect(parseMoneyInput("99999999999999999999,99")).toBeNull();
  });
});

describe("formatCents — o único lugar do sistema com casa decimal", () => {
  it("formata em BRL com agrupamento de milhar", () => {
    expect(formatCents(123456)).toBe("R$ 1.234,56");
    expect(formatCents(0)).toBe("R$ 0,00");
    expect(formatCents(5)).toBe("R$ 0,05");
    expect(formatCents(100)).toBe("R$ 1,00");
  });

  it("põe o sinal antes do símbolo, não depois", () => {
    expect(formatCents(-123456)).toBe("-R$ 1.234,56");
  });

  it("sem símbolo, para eixo de gráfico", () => {
    expect(formatCents(123456, { symbol: false })).toBe("1.234,56");
  });

  it("com sinal forçado, para variação", () => {
    expect(formatCents(500, { sign: "always" })).toBe("+R$ 5,00");
    expect(formatCents(-500, { sign: "always" })).toBe("-R$ 5,00");
    // Zero não ganha sinal: "+R$ 0,00" sugere ganho onde não houve nada.
    expect(formatCents(0, { sign: "always" })).toBe("R$ 0,00");
  });

  it("não perde precisão no limite da faixa segura", () => {
    // O caso que a divisão por 100 em ponto flutuante erraria.
    expect(formatCents(MAX)).toBe("R$ 90.071.992.547.409,91");
  });

  it("recusa formatar o que não é centavo inteiro", () => {
    expect(() => formatCents(10.5)).toThrow(TypeError);
  });
});

describe("sumCents", () => {
  it("soma a lista", () => {
    expect(sumCents([100, 250, -50])).toBe(300);
  });

  it("lista vazia soma zero", () => {
    expect(sumCents([])).toBe(0);
  });

  it("recusa parcela inválida", () => {
    expect(() => sumCents([100, 0.5])).toThrow(TypeError);
  });

  it("recusa o estouro em vez de devolver total arredondado", () => {
    const metade = 4503599627370496;
    expect(() => sumCents([metade, metade])).toThrow(RangeError);
  });
});

describe("allocate — rateio por maior resto", () => {
  it("preserva a soma no caso que o arredondamento ingênuo perde", () => {
    const partes = allocate(10000, [1, 1, 1]);

    expect(partes).toEqual([3334, 3333, 3333]);
    expect(sumCents(partes)).toBe(10000);
  });

  it("divide igual quando a divisão é exata", () => {
    expect(allocate(9000, [1, 1, 1])).toEqual([3000, 3000, 3000]);
  });

  it("respeita pesos diferentes", () => {
    const partes = allocate(10000, [50, 30, 20]);

    expect(partes).toEqual([5000, 3000, 2000]);
    expect(sumCents(partes)).toBe(10000);
  });

  it("dá a sobra a quem tem o maior resto", () => {
    // Partes exatas: 33,33 · 16,67 · 50,00. O centavo da sobra vai para o
    // MAIOR resto (4/6, do segundo), e não para o maior valor.
    const partes = allocate(100, [2, 1, 3]);

    expect(sumCents(partes)).toBe(100);
    expect(partes).toEqual([33, 17, 50]);
  });

  it("empate de resto vai para a ordem de entrada, não para uma parcela aleatória", () => {
    expect(allocate(10001, [1, 1, 1])).toEqual([3334, 3334, 3333]);
  });

  it("peso zero não recebe nada", () => {
    expect(allocate(10000, [1, 0, 1])).toEqual([5000, 0, 5000]);
  });

  it("uma parte só recebe tudo", () => {
    expect(allocate(777, [1])).toEqual([777]);
  });

  it("com total negativo o centavo extra vai para o mesmo lado", () => {
    const partes = allocate(-10000, [1, 1, 1]);

    expect(partes).toEqual([-3334, -3333, -3333]);
    expect(sumCents(partes)).toBe(-10000);
  });

  it("total zero rateia zeros", () => {
    expect(allocate(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it("não estoura mesmo quando peso × total passaria do double", () => {
    const partes = allocate(MAX, [MAX, MAX]);

    expect(sumCents(partes)).toBe(MAX);
  });

  it("recusa rateio sem peso", () => {
    expect(() => allocate(100, [])).toThrow(TypeError);
  });

  it("recusa peso negativo ou fracionário", () => {
    expect(() => allocate(100, [1, -1])).toThrow(TypeError);
    expect(() => allocate(100, [1, 1.5])).toThrow(TypeError);
  });

  it("recusa soma de pesos zero em vez de dividir por zero", () => {
    expect(() => allocate(100, [0, 0])).toThrow(TypeError);
  });

  it("recusa total que não é centavo inteiro", () => {
    expect(() => allocate(10.5, [1])).toThrow(TypeError);
  });
});
