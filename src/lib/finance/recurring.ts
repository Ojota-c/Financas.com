/**
 * Recorrência: materialização determinística de regras (assinatura, salário,
 * conta fixa), geração de parcelamento e o calendário de fatura de cartão.
 * Tudo em data civil ISO — a mesma regra com a mesma referência devolve sempre
 * as mesmas datas, em qualquer máquina e fuso.
 */

import {
  addDays,
  addMonthsClamped,
  daysInMonth,
  parseIsoDate,
  toIsoDate,
  weekdayOf,
  type IsoDate,
} from "./civil-date";
import { allocate, type Cents } from "./money";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** A cada N unidades da frequência (inteiro ≥ 1). */
  interval: number;
  /** Só para `monthly`: 1–31; dia 31 em mês curto vira o último dia do mês. */
  dayOfMonth?: number;
  /** Só para `weekly`: 0 = domingo … 6 = sábado. */
  weekday?: number;
  startDate: IsoDate;
  /** Última data admitida (inclusive). */
  endDate?: IsoDate;
  /** Total de ocorrências da regra, contado desde `startDate`. */
  occurrencesLimit?: number;
};

function validateRule(rule: RecurrenceRule): void {
  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    throw new TypeError(
      `interval precisa ser inteiro ≥ 1, veio ${rule.interval}`,
    );
  }

  parseIsoDate(rule.startDate);

  if (rule.endDate !== undefined) parseIsoDate(rule.endDate);

  if (
    rule.occurrencesLimit !== undefined &&
    (!Number.isInteger(rule.occurrencesLimit) || rule.occurrencesLimit < 0)
  ) {
    throw new TypeError(
      `occurrencesLimit precisa ser inteiro ≥ 0, veio ${rule.occurrencesLimit}`,
    );
  }

  if (rule.dayOfMonth !== undefined) {
    if (rule.frequency !== "monthly") {
      throw new TypeError("dayOfMonth só vale para frequency 'monthly'");
    }

    if (
      !Number.isInteger(rule.dayOfMonth) ||
      rule.dayOfMonth < 1 ||
      rule.dayOfMonth > 31
    ) {
      throw new TypeError(
        `dayOfMonth precisa estar entre 1 e 31, veio ${rule.dayOfMonth}`,
      );
    }
  }

  if (rule.weekday !== undefined) {
    if (rule.frequency !== "weekly") {
      throw new TypeError("weekday só vale para frequency 'weekly'");
    }

    if (
      !Number.isInteger(rule.weekday) ||
      rule.weekday < 0 ||
      rule.weekday > 6
    ) {
      throw new TypeError(
        `weekday precisa estar entre 0 e 6, veio ${rule.weekday}`,
      );
    }
  }
}

// A k-ésima ocorrência (k = 0, 1, 2…) SEMPRE derivada da âncora original, e
// não da ocorrência anterior: derivar do mês anterior clampado faria a
// mensalidade do dia 31 migrar para o dia 28 depois de fevereiro e nunca voltar.
function occurrenceAt(rule: RecurrenceRule, k: number): IsoDate {
  switch (rule.frequency) {
    case "daily":
      return addDays(rule.startDate, k * rule.interval);

    case "weekly": {
      const anchor =
        rule.weekday === undefined
          ? rule.startDate
          : addDays(
              rule.startDate,
              (rule.weekday - weekdayOf(rule.startDate) + 7) % 7,
            );

      return addDays(anchor, k * 7 * rule.interval);
    }

    case "monthly": {
      const start = parseIsoDate(rule.startDate);
      const anchorDay = rule.dayOfMonth ?? start.day;

      // Se o dia da regra já passou no mês do start, a série começa no mês
      // seguinte — nenhuma ocorrência pode ser anterior ao startDate.
      const firstInStartMonth =
        Math.min(anchorDay, daysInMonth(start.year, start.month)) >= start.day;

      const index =
        start.year * 12 +
        (start.month - 1) +
        (firstInStartMonth ? 0 : 1) +
        k * rule.interval;
      const year = Math.floor(index / 12);
      const month = index - year * 12 + 1;

      return toIsoDate({
        year,
        month,
        day: Math.min(anchorDay, daysInMonth(year, month)),
      });
    }

    case "yearly": {
      const start = parseIsoDate(rule.startDate);
      const year = start.year + k * rule.interval;

      // 29/02 em ano comum vira 28/02 — mesmo clamp do mês curto.
      return toIsoDate({
        year,
        month: start.month,
        day: Math.min(start.day, daysInMonth(year, start.month)),
      });
    }
  }
}

/**
 * As próximas `count` ocorrências a partir de `fromDate` (inclusive — uma
 * cobrança de hoje ainda está por acontecer). Respeita `endDate` e
 * `occurrencesLimit`, que contam desde o início da regra, não da referência.
 */
export function nextOccurrences(
  rule: RecurrenceRule,
  fromDate: IsoDate,
  count: number,
): IsoDate[] {
  validateRule(rule);
  parseIsoDate(fromDate);

  if (!Number.isInteger(count) || count < 0) {
    throw new TypeError(`count precisa ser inteiro ≥ 0, veio ${count}`);
  }

  const occurrences: IsoDate[] = [];

  // Termina sempre: as ocorrências crescem estritamente, então ou o limite/fim
  // corta a série, ou `count` datas ≥ fromDate são alcançadas.
  for (let k = 0; occurrences.length < count; k += 1) {
    if (rule.occurrencesLimit !== undefined && k >= rule.occurrencesLimit)
      break;

    const occurrence = occurrenceAt(rule, k);

    if (rule.endDate !== undefined && occurrence > rule.endDate) break;
    if (occurrence >= fromDate) occurrences.push(occurrence);
  }

  return occurrences;
}

export type InstallmentPlanInput = {
  totalCents: Cents;
  /** Número de parcelas (inteiro ≥ 1). */
  installmentTotal: number;
  /** Vencimento da 1ª parcela; as demais caem no mesmo dia dos meses seguintes, com clamp em mês curto. */
  firstDueDate: IsoDate;
};

export type Installment = {
  /** 1-based, como aparece na fatura: "3/12". */
  installmentNo: number;
  installmentTotal: number;
  amountCents: Cents;
  dueDate: IsoDate;
};

/**
 * Parcelamento: o rateio é o `allocate` do money.ts (maior resto), então a
 * soma das parcelas é EXATAMENTE o total e o centavo de sobra cai nas
 * primeiras parcelas, sempre nas mesmas. As datas ancoram no dia da primeira
 * parcela: 31/jan → 28/fev → 31/mar.
 */
export function generateInstallments({
  totalCents,
  installmentTotal,
  firstDueDate,
}: InstallmentPlanInput): Installment[] {
  if (!Number.isInteger(installmentTotal) || installmentTotal < 1) {
    throw new TypeError(
      `número de parcelas precisa ser inteiro ≥ 1, veio ${installmentTotal}`,
    );
  }

  const amounts = allocate(
    totalCents,
    new Array<number>(installmentTotal).fill(1),
  );

  return amounts.map((amountCents, index) => ({
    installmentNo: index + 1,
    installmentTotal,
    amountCents,
    dueDate: addMonthsClamped(firstDueDate, index),
  }));
}

export type CardInvoiceInput = {
  /** Dia do fechamento (1–31; em mês curto vale o último dia do mês). */
  closingDay: number;
  /** Dia do vencimento (1–31, mesmo clamp). */
  dueDay: number;
  purchaseDate: IsoDate;
};

export type CardInvoice = {
  /** Data de fechamento da fatura em que a compra cai — a competência dela. */
  competenceDate: IsoDate;
  dueDate: IsoDate;
};

function nextMonth({ year, month }: { year: number; month: number }): {
  year: number;
  month: number;
} {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

/**
 * Em que fatura a compra cai e quando ela vence.
 *
 * Compra até o dia do fechamento (inclusive) pertence à fatura que fecha
 * naquele dia; depois dele, à seguinte. O vencimento é a primeira ocorrência
 * do `dueDay` DEPOIS do fechamento: com `dueDay ≤ closingDay` ele só chega no
 * mês seguinte (fecha dia 28, vence dia 5 do outro mês). A comparação usa os
 * dias contratados, sem clamp — senão um fevereiro curto mudaria de lado uma
 * fatura que vence "dia 31".
 */
export function cardInvoiceFor({
  closingDay,
  dueDay,
  purchaseDate,
}: CardInvoiceInput): CardInvoice {
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31) {
    throw new TypeError(
      `closingDay precisa estar entre 1 e 31, veio ${closingDay}`,
    );
  }

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new TypeError(`dueDay precisa estar entre 1 e 31, veio ${dueDay}`);
  }

  const purchase = parseIsoDate(purchaseDate);

  const closingInPurchaseMonth = Math.min(
    closingDay,
    daysInMonth(purchase.year, purchase.month),
  );

  const closingMonth =
    purchase.day <= closingInPurchaseMonth
      ? { year: purchase.year, month: purchase.month }
      : nextMonth(purchase);

  const competenceDate = toIsoDate({
    ...closingMonth,
    day: Math.min(
      closingDay,
      daysInMonth(closingMonth.year, closingMonth.month),
    ),
  });

  const dueMonth = dueDay > closingDay ? closingMonth : nextMonth(closingMonth);

  const dueDate = toIsoDate({
    ...dueMonth,
    day: Math.min(dueDay, daysInMonth(dueMonth.year, dueMonth.month)),
  });

  return { competenceDate, dueDate };
}
