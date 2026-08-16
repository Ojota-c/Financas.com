import { describe, expect, it } from "vitest";

import {
  cardInvoiceFor,
  generateInstallments,
  nextOccurrences,
  sumCents,
  type RecurrenceRule,
} from "@/lib/finance";

const monthly = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "monthly",
  interval: 1,
  startDate: "2026-01-31",
  ...overrides,
});

describe("nextOccurrences — materialização determinística", () => {
  it("daily respeita o intervalo", () => {
    expect(
      nextOccurrences(
        { frequency: "daily", interval: 3, startDate: "2026-08-01" },
        "2026-08-01",
        3,
      ),
    ).toEqual(["2026-08-01", "2026-08-04", "2026-08-07"]);
  });

  it("weekly sem weekday ancora no dia da semana do início", () => {
    expect(
      nextOccurrences(
        { frequency: "weekly", interval: 1, startDate: "2026-08-05" },
        "2026-08-05",
        2,
      ),
    ).toEqual(["2026-08-05", "2026-08-12"]);
  });

  it("weekly com weekday avança até o primeiro dia da semana pedido", () => {
    // 2026-08-05 é quarta; a primeira sexta (5) é 07/08.
    expect(
      nextOccurrences(
        {
          frequency: "weekly",
          interval: 2,
          weekday: 5,
          startDate: "2026-08-05",
        },
        "2026-08-05",
        2,
      ),
    ).toEqual(["2026-08-07", "2026-08-21"]);
  });

  it("monthly no dia 31: mês curto vira último dia, e o dia 31 VOLTA depois", () => {
    expect(nextOccurrences(monthly(), "2026-01-01", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("fevereiro bissexto clampa em 29", () => {
    expect(
      nextOccurrences(monthly({ startDate: "2024-01-31" }), "2024-02-01", 1),
    ).toEqual(["2024-02-29"]);
  });

  it("dayOfMonth já passado no mês do início empurra a 1ª ocorrência para o mês seguinte", () => {
    expect(
      nextOccurrences(
        monthly({ startDate: "2026-01-20", dayOfMonth: 15 }),
        "2026-01-01",
        2,
      ),
    ).toEqual(["2026-02-15", "2026-03-15"]);
  });

  it("dayOfMonth ainda por vir no mês do início ocorre nele mesmo", () => {
    expect(
      nextOccurrences(
        monthly({ startDate: "2026-01-10", dayOfMonth: 15, interval: 2 }),
        "2026-01-01",
        3,
      ),
    ).toEqual(["2026-01-15", "2026-03-15", "2026-05-15"]);
  });

  it("yearly clampa 29/02 para 28/02 em ano comum", () => {
    expect(
      nextOccurrences(
        { frequency: "yearly", interval: 1, startDate: "2024-02-29" },
        "2024-01-01",
        3,
      ),
    ).toEqual(["2024-02-29", "2025-02-28", "2026-02-28"]);
  });

  it("a referência corta o passado, inclusive — ocorrência de hoje ainda vale", () => {
    expect(nextOccurrences(monthly(), "2026-03-31", 2)).toEqual([
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("endDate encerra a série", () => {
    expect(
      nextOccurrences(monthly({ endDate: "2026-03-01" }), "2026-01-01", 10),
    ).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("occurrencesLimit conta desde o início da regra, não da referência", () => {
    expect(
      nextOccurrences(monthly({ occurrencesLimit: 3 }), "2026-03-01", 10),
    ).toEqual(["2026-03-31"]);
  });

  it("count 0 devolve lista vazia", () => {
    expect(nextOccurrences(monthly(), "2026-01-01", 0)).toEqual([]);
  });

  it("recusa regra malformada", () => {
    expect(() =>
      nextOccurrences(monthly({ interval: 0 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ interval: 1.5 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ startDate: "31/01/2026" }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ endDate: "amanhã" }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ occurrencesLimit: -1 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ occurrencesLimit: 1.5 }), "2026-01-01", 1),
    ).toThrow(TypeError);
  });

  it("recusa dayOfMonth fora de 1–31 ou fora do monthly", () => {
    expect(() =>
      nextOccurrences(monthly({ dayOfMonth: 0 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ dayOfMonth: 32 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(monthly({ dayOfMonth: 1.5 }), "2026-01-01", 1),
    ).toThrow(TypeError);
    expect(() =>
      nextOccurrences(
        {
          frequency: "daily",
          interval: 1,
          startDate: "2026-01-01",
          dayOfMonth: 5,
        },
        "2026-01-01",
        1,
      ),
    ).toThrow(TypeError);
  });

  it("recusa weekday fora de 0–6 ou fora do weekly", () => {
    const weekly = (weekday: number): RecurrenceRule => ({
      frequency: "weekly",
      interval: 1,
      startDate: "2026-01-01",
      weekday,
    });

    expect(() => nextOccurrences(weekly(-1), "2026-01-01", 1)).toThrow(
      TypeError,
    );
    expect(() => nextOccurrences(weekly(7), "2026-01-01", 1)).toThrow(
      TypeError,
    );
    expect(() => nextOccurrences(weekly(1.5), "2026-01-01", 1)).toThrow(
      TypeError,
    );
    expect(() =>
      nextOccurrences(monthly({ weekday: 1 }), "2026-01-01", 1),
    ).toThrow(TypeError);
  });

  it("recusa referência malformada e count inválido", () => {
    expect(() => nextOccurrences(monthly(), "ontem", 1)).toThrow(TypeError);
    expect(() => nextOccurrences(monthly(), "2026-01-01", -1)).toThrow(
      TypeError,
    );
    expect(() => nextOccurrences(monthly(), "2026-01-01", 1.5)).toThrow(
      TypeError,
    );
  });
});

describe("generateInstallments — parcelamento por maior resto", () => {
  it("numera as parcelas e preserva a soma exata", () => {
    const installments = generateInstallments({
      totalCents: 10000,
      installmentTotal: 3,
      firstDueDate: "2026-01-31",
    });

    expect(installments.map((parcel) => parcel.amountCents)).toEqual([
      3334, 3333, 3333,
    ]);
    expect(sumCents(installments.map((parcel) => parcel.amountCents))).toBe(
      10000,
    );
    expect(installments.map((parcel) => parcel.installmentNo)).toEqual([
      1, 2, 3,
    ]);
    expect(installments[0]!.installmentTotal).toBe(3);
  });

  it("as datas ancoram no dia da 1ª parcela: 31/jan → 28/fev → 31/mar", () => {
    const installments = generateInstallments({
      totalCents: 30000,
      installmentTotal: 3,
      firstDueDate: "2026-01-31",
    });

    expect(installments.map((parcel) => parcel.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("recusa número de parcelas que não é inteiro ≥ 1", () => {
    expect(() =>
      generateInstallments({
        totalCents: 100,
        installmentTotal: 0,
        firstDueDate: "2026-01-01",
      }),
    ).toThrow(TypeError);
    expect(() =>
      generateInstallments({
        totalCents: 100,
        installmentTotal: 2.5,
        firstDueDate: "2026-01-01",
      }),
    ).toThrow(TypeError);
  });
});

describe("cardInvoiceFor — em que fatura a compra cai", () => {
  it("compra até o dia do fechamento pertence à fatura do mês", () => {
    expect(
      cardInvoiceFor({ closingDay: 28, dueDay: 5, purchaseDate: "2026-08-10" }),
    ).toEqual({ competenceDate: "2026-08-28", dueDate: "2026-09-05" });

    expect(
      cardInvoiceFor({ closingDay: 28, dueDay: 5, purchaseDate: "2026-08-28" }),
    ).toEqual({ competenceDate: "2026-08-28", dueDate: "2026-09-05" });
  });

  it("compra após o fechamento cai na fatura seguinte", () => {
    expect(
      cardInvoiceFor({ closingDay: 28, dueDay: 5, purchaseDate: "2026-08-29" }),
    ).toEqual({ competenceDate: "2026-09-28", dueDate: "2026-10-05" });
  });

  it("vencimento no mesmo mês quando dueDay vem depois do fechamento", () => {
    expect(
      cardInvoiceFor({ closingDay: 5, dueDay: 15, purchaseDate: "2026-08-03" }),
    ).toEqual({ competenceDate: "2026-08-05", dueDate: "2026-08-15" });
  });

  it("fechamento dia 31 em fevereiro vale o último dia do mês", () => {
    expect(
      cardInvoiceFor({
        closingDay: 31,
        dueDay: 10,
        purchaseDate: "2026-02-28",
      }),
    ).toEqual({ competenceDate: "2026-02-28", dueDate: "2026-03-10" });

    // Em março o fechamento volta a ser dia 31.
    expect(
      cardInvoiceFor({
        closingDay: 31,
        dueDay: 10,
        purchaseDate: "2026-03-01",
      }),
    ).toEqual({ competenceDate: "2026-03-31", dueDate: "2026-04-10" });
  });

  it("dezembro → janeiro: a virada de ano não engole a fatura", () => {
    expect(
      cardInvoiceFor({
        closingDay: 15,
        dueDay: 22,
        purchaseDate: "2026-12-20",
      }),
    ).toEqual({ competenceDate: "2027-01-15", dueDate: "2027-01-22" });

    expect(
      cardInvoiceFor({ closingDay: 31, dueDay: 8, purchaseDate: "2026-12-31" }),
    ).toEqual({ competenceDate: "2026-12-31", dueDate: "2027-01-08" });
  });

  it("recusa dias de fechamento e vencimento fora de 1–31", () => {
    expect(() =>
      cardInvoiceFor({ closingDay: 0, dueDay: 5, purchaseDate: "2026-01-01" }),
    ).toThrow(TypeError);
    expect(() =>
      cardInvoiceFor({ closingDay: 32, dueDay: 5, purchaseDate: "2026-01-01" }),
    ).toThrow(TypeError);
    expect(() =>
      cardInvoiceFor({
        closingDay: 1.5,
        dueDay: 5,
        purchaseDate: "2026-01-01",
      }),
    ).toThrow(TypeError);
    expect(() =>
      cardInvoiceFor({ closingDay: 28, dueDay: 0, purchaseDate: "2026-01-01" }),
    ).toThrow(TypeError);
    expect(() =>
      cardInvoiceFor({
        closingDay: 28,
        dueDay: 32,
        purchaseDate: "2026-01-01",
      }),
    ).toThrow(TypeError);
    expect(() =>
      cardInvoiceFor({
        closingDay: 28,
        dueDay: 5.5,
        purchaseDate: "2026-01-01",
      }),
    ).toThrow(TypeError);
  });
});
