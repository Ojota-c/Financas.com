import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  diffDays,
  isLeapYear,
  parseIsoDate,
  toIsoDate,
  weekdayOf,
} from "@/lib/finance";

describe("isLeapYear — as três regras gregorianas", () => {
  it("ano comum não é bissexto", () => {
    expect(isLeapYear(2026)).toBe(false);
  });

  it("divisível por 4 é bissexto", () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it("virada de século não é bissexta, exceto a divisível por 400", () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("daysInMonth", () => {
  it("conhece os meses de 31, 30 e fevereiro", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it("recusa mês ou ano que não existem", () => {
    expect(() => daysInMonth(2026.5, 1)).toThrow(TypeError);
    expect(() => daysInMonth(2026, 1.5)).toThrow(TypeError);
    expect(() => daysInMonth(2026, 0)).toThrow(TypeError);
    expect(() => daysInMonth(2026, 13)).toThrow(TypeError);
  });
});

describe("parseIsoDate — a borda de entrada de toda data do motor", () => {
  it("lê a data válida", () => {
    expect(parseIsoDate("2026-08-16")).toEqual({
      year: 2026,
      month: 8,
      day: 16,
    });
    expect(parseIsoDate("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
  });

  it("recusa formato que não é YYYY-MM-DD", () => {
    expect(() => parseIsoDate("16/08/2026")).toThrow(TypeError);
    expect(() => parseIsoDate("2026-8-16")).toThrow(TypeError);
    expect(() => parseIsoDate("")).toThrow(TypeError);
  });

  it("recusa data que passa no regex mas não existe no calendário", () => {
    expect(() => parseIsoDate("2026-00-10")).toThrow(TypeError);
    expect(() => parseIsoDate("2026-13-01")).toThrow(TypeError);
    expect(() => parseIsoDate("2026-05-00")).toThrow(TypeError);
    expect(() => parseIsoDate("2026-02-30")).toThrow(TypeError);
    expect(() => parseIsoDate("2026-02-29")).toThrow(TypeError);
  });
});

describe("toIsoDate", () => {
  it("preenche zeros à esquerda para a comparação lexicográfica valer", () => {
    expect(toIsoDate({ year: 2026, month: 3, day: 5 })).toBe("2026-03-05");
    expect(toIsoDate({ year: 476, month: 12, day: 25 })).toBe("0476-12-25");
  });
});

describe("addDays", () => {
  it("soma e subtrai dias", () => {
    expect(addDays("2026-08-16", 1)).toBe("2026-08-17");
    expect(addDays("2026-08-16", -16)).toBe("2026-07-31");
    expect(addDays("2026-08-16", 0)).toBe("2026-08-16");
  });

  it("atravessa fevereiro certo em ano comum e bissexto", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("atravessa a virada do ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("recusa dias fracionários", () => {
    expect(() => addDays("2026-08-16", 1.5)).toThrow(TypeError);
  });
});

describe("diffDays", () => {
  it("conta os dias entre duas datas, com sinal", () => {
    expect(diffDays("2026-08-01", "2026-08-16")).toBe(15);
    expect(diffDays("2026-08-16", "2026-08-01")).toBe(-15);
  });

  it("sabe que 2024 teve 366 dias e 2026 tem 365", () => {
    expect(diffDays("2024-01-01", "2025-01-01")).toBe(366);
    expect(diffDays("2026-01-01", "2027-01-01")).toBe(365);
  });
});

describe("weekdayOf", () => {
  it("acerta âncoras conhecidas (0 = domingo)", () => {
    expect(weekdayOf("1970-01-01")).toBe(4); // quinta
    expect(weekdayOf("2000-01-01")).toBe(6); // sábado
    expect(weekdayOf("2026-08-16")).toBe(0); // domingo
  });
});

describe("addMonthsClamped", () => {
  it("mantém o dia quando ele existe no mês de destino", () => {
    expect(addMonthsClamped("2026-08-16", 1)).toBe("2026-09-16");
    expect(addMonthsClamped("2026-08-16", -2)).toBe("2026-06-16");
  });

  it("clampa dia 31 para o último dia do mês curto", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("a âncora é a data dada: somar 2 a partir de 31/jan volta ao dia 31", () => {
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("atravessa dezembro → janeiro", () => {
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsClamped("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("recusa meses fracionários", () => {
    expect(() => addMonthsClamped("2026-08-16", 0.5)).toThrow(TypeError);
  });
});
