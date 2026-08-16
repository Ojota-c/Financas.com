/**
 * Insights do §5.2: gastos formiga, curva ABC/Pareto, radar de assinaturas,
 * inflação pessoal e custo em horas de trabalho — os números que fazem a
 * pessoa VER o padrão, não só o extrato.
 */

import { parseIsoDate, type IsoDate } from "./civil-date";
import { assertCents, type Cents } from "./money";

export type AntExpenseSummary = {
  totalCents: Cents;
  count: number;
  /** Fração da renda (0.14 = 14%); `null` com renda ≤ 0 — sem renda não há porcentagem honesta. */
  incomeFraction: number | null;
};

/**
 * Gastos formiga: despesas pequenas (0 < valor < limiar) somadas para mostrar
 * o estrago do conjunto. Estornos e zeros ficam de fora — formiga é gasto.
 */
export function antExpenses(
  expensesCents: readonly Cents[],
  thresholdCents: Cents,
  incomeCents: Cents,
): AntExpenseSummary {
  assertCents(thresholdCents, "limiar de gasto formiga");
  assertCents(incomeCents, "renda do mês");

  let totalCents = 0;
  let count = 0;

  for (const amount of expensesCents) {
    assertCents(amount, "despesa");

    if (amount > 0 && amount < thresholdCents) {
      totalCents += amount;
      count += 1;
    }
  }

  return {
    totalCents,
    count,
    incomeFraction: incomeCents > 0 ? totalCents / incomeCents : null,
  };
}

export type CategoryTotal = {
  name: string;
  totalCents: Cents;
};

export type ParetoConcentration = {
  /** Quantas categorias (as maiores) bastam para cobrir a fração-alvo do gasto. */
  categoriesNeeded: number;
  /** As categorias contadas, da maior para a menor. */
  topCategories: readonly string[];
  /** Categorias com gasto positivo consideradas na conta. */
  totalCategories: number;
  /** Fração exata coberta pelas categorias devolvidas. */
  topShareFraction: number;
};

/**
 * Curva ABC: "3 categorias concentram 71% dos seus gastos" (§5.2). Categorias
 * com total ≤ 0 (estorno líquido) ficam fora — participação negativa faria a
 * fração acumulada regredir e a contagem perder o sentido. Empate de valor
 * mantém a ordem de entrada (sort estável). Sem gasto positivo, tudo zera —
 * nunca divisão por zero.
 */
export function paretoConcentration(
  totals: readonly CategoryTotal[],
  targetFraction = 0.8,
): ParetoConcentration {
  if (
    !Number.isFinite(targetFraction) ||
    targetFraction <= 0 ||
    targetFraction > 1
  ) {
    throw new TypeError(
      `fração-alvo precisa estar em (0, 1], veio ${targetFraction}`,
    );
  }

  for (const total of totals)
    assertCents(total.totalCents, "total da categoria");

  const positives = totals.filter((total) => total.totalCents > 0);
  const grandTotal = positives.reduce(
    (acc, total) => acc + total.totalCents,
    0,
  );

  if (grandTotal === 0) {
    return {
      categoriesNeeded: 0,
      topCategories: [],
      totalCategories: 0,
      topShareFraction: 0,
    };
  }

  const sorted = [...positives].sort((a, b) => b.totalCents - a.totalCents);

  let cumulative = 0;
  const topCategories: string[] = [];

  for (const category of sorted) {
    cumulative += category.totalCents;
    topCategories.push(category.name);

    if (cumulative / grandTotal >= targetFraction) break;
  }

  return {
    categoriesNeeded: topCategories.length,
    topCategories,
    totalCategories: positives.length,
    topShareFraction: cumulative / grandTotal,
  };
}

/**
 * Normalização de descrição para agrupar a mesma cobrança: minúsculas, sem
 * acento, e dígitos/pontuação viram espaço — "PAG*NETFLIX 04/12" e
 * "PAG*NETFLIX 05/12" são a mesma assinatura; o que muda entre meses é ruído
 * de parcela e data, nunca o nome.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export type SubscriptionCharge = {
  description: string;
  amountCents: Cents;
  date: IsoDate;
};

export type SubscriptionRadarOptions = {
  /** Variação tolerada entre meses consecutivos, como fração do valor anterior. Padrão 0.1. */
  toleranceFraction?: number;
  /** Meses consecutivos mínimos para virar assinatura. Padrão 3, mínimo 2. */
  minConsecutiveMonths?: number;
};

export type DetectedSubscription = {
  normalizedDescription: string;
  lastAmountCents: Cents;
  /** Custo real anual (§6.3): última mensalidade × 12 — o número que faz cancelar. */
  annualizedCents: Cents;
  consecutiveMonths: number;
  /** Última cobrança maior que a primeira da sequência. */
  priceIncreased: boolean;
};

/**
 * Radar de assinaturas (§5.2): mesma descrição normalizada, em meses
 * consecutivos, com valor igual ou variação dentro da tolerância. Só a
 * sequência que termina na cobrança mais recente conta — assinatura cancelada
 * há meses é história, não radar. Mais de uma cobrança no mesmo mês: vale a
 * mais recente (a anterior costuma ser ajuste ou estorno parcial).
 * Saída ordenada por custo anualizado, do maior para o menor.
 */
export function subscriptionRadar(
  charges: readonly SubscriptionCharge[],
  options: SubscriptionRadarOptions = {},
): DetectedSubscription[] {
  const toleranceFraction = options.toleranceFraction ?? 0.1;
  const minConsecutiveMonths = options.minConsecutiveMonths ?? 3;

  if (!Number.isFinite(toleranceFraction) || toleranceFraction < 0) {
    throw new TypeError(
      `tolerância precisa ser fração ≥ 0, veio ${toleranceFraction}`,
    );
  }

  if (!Number.isInteger(minConsecutiveMonths) || minConsecutiveMonths < 2) {
    throw new TypeError(
      `mínimo de meses precisa ser inteiro ≥ 2, veio ${minConsecutiveMonths}`,
    );
  }

  type MonthCharge = { amountCents: Cents; date: IsoDate };
  const groups = new Map<string, Map<number, MonthCharge>>();

  for (const charge of charges) {
    assertCents(charge.amountCents, "valor da cobrança");

    const { year, month } = parseIsoDate(charge.date);

    // Estorno e zero não são assinatura.
    if (charge.amountCents <= 0) continue;

    const key = normalizeDescription(charge.description);

    // Descrição sem letra nenhuma não agrupa nada com confiança.
    if (key === "") continue;

    const monthKey = year * 12 + (month - 1);
    let byMonth = groups.get(key);

    if (byMonth === undefined) {
      byMonth = new Map();
      groups.set(key, byMonth);
    }

    const existing = byMonth.get(monthKey);

    if (existing === undefined || charge.date >= existing.date) {
      byMonth.set(monthKey, {
        amountCents: charge.amountCents,
        date: charge.date,
      });
    }
  }

  const detected: DetectedSubscription[] = [];

  for (const [key, byMonth] of groups) {
    const monthKeys = [...byMonth.keys()].sort((a, b) => a - b);

    // Caminha da cobrança mais recente para trás enquanto os meses são
    // consecutivos e o valor fica dentro da tolerância.
    let runStart = monthKeys.length - 1;

    while (runStart > 0) {
      const previous = byMonth.get(monthKeys[runStart - 1]!)!;
      const current = byMonth.get(monthKeys[runStart]!)!;

      if (monthKeys[runStart]! - monthKeys[runStart - 1]! !== 1) break;

      if (
        Math.abs(current.amountCents - previous.amountCents) >
        previous.amountCents * toleranceFraction
      ) {
        break;
      }

      runStart -= 1;
    }

    const consecutiveMonths = monthKeys.length - runStart;

    if (consecutiveMonths < minConsecutiveMonths) continue;

    const firstAmount = byMonth.get(monthKeys[runStart]!)!.amountCents;
    const lastAmount = byMonth.get(
      monthKeys[monthKeys.length - 1]!,
    )!.amountCents;

    detected.push({
      normalizedDescription: key,
      lastAmountCents: lastAmount,
      annualizedCents: lastAmount * 12,
      consecutiveMonths,
      priceIncreased: lastAmount > firstAmount,
    });
  }

  return detected.sort(
    (a, b) =>
      b.annualizedCents - a.annualizedCents ||
      a.normalizedDescription.localeCompare(b.normalizedDescription),
  );
}

/**
 * Inflação pessoal (§5.2): cesta de gastos do ano atual contra a do anterior,
 * como fração (0.092 = +9,2%; negativo é deflação). Sem cesta anterior
 * positiva não há base de comparação: `null`, nunca divisão por zero.
 */
export function personalInflation(
  currentYearBasketCents: Cents,
  previousYearBasketCents: Cents,
): number | null {
  assertCents(currentYearBasketCents, "cesta do ano atual");
  assertCents(previousYearBasketCents, "cesta do ano anterior");

  if (previousYearBasketCents <= 0) return null;

  return currentYearBasketCents / previousYearBasketCents - 1;
}

/**
 * Custo em horas de trabalho (§5.2): valor ÷ (salário líquido ÷ horas/mês).
 * Devolve horas como número cru — quem exibe arredonda ("≈ 8,5 horas").
 * Salário ou carga horária ≤ 0 → `null`: sem valor-hora não existe a conta.
 */
export function costInWorkHours(
  valueCents: Cents,
  netMonthlySalaryCents: Cents,
  hoursPerMonth: number,
): number | null {
  assertCents(valueCents, "valor da compra");
  assertCents(netMonthlySalaryCents, "salário líquido");

  if (!Number.isFinite(hoursPerMonth)) {
    throw new TypeError(
      `horas por mês precisa ser número finito, veio ${hoursPerMonth}`,
    );
  }

  if (netMonthlySalaryCents <= 0 || hoursPerMonth <= 0) return null;

  return (valueCents * hoursPerMonth) / netMonthlySalaryCents;
}
