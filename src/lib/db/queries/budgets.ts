import "server-only";

import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { budgets, categories, transactions } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { parseCents, type Cents } from "@/lib/finance";
import { primeiroDiaDoMes, ultimoDiaDoMes } from "@/lib/utils/dates";

import type { ContextoDaSessao } from "./accounts";

/**
 * Uma categoria-folha de despesa e seu orçamento no mês — tenha ela teto
 * definido ou não. A tela lista TODAS as folhas de propósito: orçamento se
 * constrói vendo o que ainda não tem teto, não só o que já tem.
 *
 * Os números do mês anterior vêm juntos porque o rollover precisa deles; o
 * CÁLCULO da sobra é do motor puro (`lib/finance/budget`), não daqui — a query
 * entrega matéria-prima, quem decide é função testada.
 */
export type LinhaDeOrcamento = {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  parentName: string;
  budgetId: string | null;
  limitCents: Cents | null;
  rollover: boolean;
  spentCents: Cents;
  prevLimitCents: Cents | null;
  prevRollover: boolean;
  prevSpentCents: Cents;
};

/** Gasto compensado por categoria dentro de um intervalo, como mapa. */
async function gastoPorCategoria(
  tx: Parameters<Parameters<typeof withUser>[2]>[0],
  de: string,
  ate: string,
): Promise<Map<string, Cents>> {
  const linhas = await tx
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "expense"),
        eq(transactions.status, "cleared"),
        gte(transactions.date, de),
        lte(transactions.date, ate),
        isNotNull(transactions.categoryId),
      ),
    )
    .groupBy(transactions.categoryId);

  return new Map(
    linhas.map((linha) => [linha.categoryId!, parseCents(linha.total)]),
  );
}

export async function listarOrcamentoDoMes(
  { userId, workspaceId }: ContextoDaSessao,
  period: string,
): Promise<LinhaDeOrcamento[]> {
  const mesAnterior = mesAnteriorDe(period);

  return withUser(userId, workspaceId, async (tx) => {
    // Folhas de despesa com o nome do pai — o agrupamento visual da tela.
    const pai = alias(categories, "parent");

    const folhas = await tx
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        parentName: pai.name,
      })
      .from(categories)
      .innerJoin(pai, eq(pai.id, categories.parentId))
      .where(
        and(
          eq(categories.kind, "expense"),
          eq(categories.isArchived, false),
          isNotNull(categories.parentId),
        ),
      )
      .orderBy(asc(pai.sortOrder), asc(categories.sortOrder));

    const [doMes, doAnterior, gastoDoMes, gastoAnterior] = await Promise.all([
      tx.select().from(budgets).where(eq(budgets.period, period)),
      tx.select().from(budgets).where(eq(budgets.period, mesAnterior)),
      gastoPorCategoria(tx, period, ultimoDiaDoMes(period)),
      gastoPorCategoria(tx, mesAnterior, ultimoDiaDoMes(mesAnterior)),
    ]);

    const orcamentoDoMes = new Map(doMes.map((b) => [b.categoryId, b]));
    const orcamentoAnterior = new Map(doAnterior.map((b) => [b.categoryId, b]));

    return folhas.map((folha) => {
      const atual = orcamentoDoMes.get(folha.categoryId);
      const anterior = orcamentoAnterior.get(folha.categoryId);

      return {
        ...folha,
        budgetId: atual?.id ?? null,
        limitCents: atual?.limitCents ?? null,
        rollover: atual?.rollover ?? false,
        spentCents: gastoDoMes.get(folha.categoryId) ?? 0,
        prevLimitCents: anterior?.limitCents ?? null,
        prevRollover: anterior?.rollover ?? false,
        prevSpentCents: gastoAnterior.get(folha.categoryId) ?? 0,
      };
    });
  });
}

function mesAnteriorDe(period: string): string {
  const [ano, mes] = period.split("-").map(Number);
  const anterior = new Date(Date.UTC(ano!, mes! - 2, 1));

  return primeiroDiaDoMes(
    `${anterior.getUTCFullYear()}-${String(anterior.getUTCMonth() + 1).padStart(2, "0")}-01`,
  );
}

export type NovoOrcamento = {
  categoryId: string;
  period: string;
  limitCents: Cents;
  rollover: boolean;
};

/**
 * Upsert na chave (workspace, categoria, mês): redefinir o teto do mês é
 * sobrescrever, não duplicar — a unique do banco garante e o conflito resolve.
 */
export async function definirOrcamento(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovoOrcamento,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx
      .insert(budgets)
      .values({ ...dados, workspaceId })
      .onConflictDoUpdate({
        target: [budgets.workspaceId, budgets.categoryId, budgets.period],
        set: {
          limitCents: dados.limitCents,
          rollover: dados.rollover,
          updatedAt: sql`now()`,
        },
      });
  });
}

export async function removerOrcamento(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.delete(budgets).where(eq(budgets.id, id));
  });
}
