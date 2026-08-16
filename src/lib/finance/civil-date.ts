/**
 * Calendário civil puro: data como texto ISO `"YYYY-MM-DD"` — o mesmo formato
 * do `DATE` do Postgres — e aritmética em inteiros, sem o objeto `Date` do JS.
 * `Date` carrega fuso e relógio, e os dois são proibidos aqui (regra 5: a data
 * de referência é sempre parâmetro); texto ISO validado ainda ganha de graça a
 * comparação cronológica por ordem lexicográfica.
 *
 * A conversão data ↔ número de dias usa o algoritmo de Howard Hinnant
 * (days_from_civil), exato para todo o calendário gregoriano.
 */

/** Data civil em ISO `"YYYY-MM-DD"`. Validada, compara cronologicamente com `<`/`>`. */
export type IsoDate = string;

export type CivilDate = { year: number; month: number; day: number };

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const DAYS_BY_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Dias do mês (1–12). Fevereiro consulta `isLeapYear`. */
export function daysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new TypeError(`mês inválido: ${year}-${month}`);
  }

  if (month === 2 && isLeapYear(year)) return 29;

  return DAYS_BY_MONTH[month - 1]!;
}

/**
 * A borda de entrada de toda data do motor: valida formato E existência.
 * "2026-02-30" passa em regex boba e viraria dado corrompido calado.
 */
export function parseIsoDate(iso: IsoDate): CivilDate {
  const match = ISO_DATE_RE.exec(iso);

  if (!match) {
    throw new TypeError(
      `data civil malformada: "${iso}" (esperado YYYY-MM-DD)`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new TypeError(`data civil inexistente: "${iso}"`);
  }

  return { year, month, day };
}

export function toIsoDate({ year, month, day }: CivilDate): IsoDate {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

// Dias desde 1970-01-01 (Hinnant, days_from_civil): o ano começa em março para
// o dia extra do bissexto cair na última posição e sumir da conta dos meses.
function toDayNumber({ year, month, day }: CivilDate): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;

  return era * 146097 + doe - 719468;
}

// Inversa exata de toDayNumber (Hinnant, civil_from_days).
function fromDayNumber(dayNumber: number): CivilDate {
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;

  return { year: month <= 2 ? y + 1 : y, month, day };
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) {
    throw new TypeError(`dias precisa ser inteiro, veio ${days}`);
  }

  return toIsoDate(fromDayNumber(toDayNumber(parseIsoDate(date)) + days));
}

/** Dias de `from` até `to` (positivo quando `to` é depois). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toDayNumber(parseIsoDate(to)) - toDayNumber(parseIsoDate(from));
}

/** Dia da semana, 0 = domingo … 6 = sábado — a mesma convenção do JS. */
export function weekdayOf(date: IsoDate): number {
  // 1970-01-01 (dia 0) foi quinta-feira (4).
  return (((toDayNumber(parseIsoDate(date)) + 4) % 7) + 7) % 7;
}

/**
 * Soma meses preservando o dia da data DADA como âncora, com clamp em mês
 * curto: 31/jan + 1 = 28/fev. Para manter a âncora numa série (31, 31, 31…),
 * some sempre a partir da data original — somar sobre o resultado clampado
 * faria 31/jan → 28/fev → 28/mar, e a mensalidade "do dia 31" migra de dia.
 */
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  if (!Number.isInteger(months)) {
    throw new TypeError(`meses precisa ser inteiro, veio ${months}`);
  }

  const { year, month, day } = parseIsoDate(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;

  return toIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}
