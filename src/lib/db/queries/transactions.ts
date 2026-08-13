import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";

import { accounts, categories, transactions } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { parseCents, type Cents } from "@/lib/finance";

import type { ContextoDaSessao } from "./accounts";

export type Lancamento = {
  id: string;
  type: string;
  amountCents: Cents;
  date: string;
  competenceDate: string;
  description: string;
  notes: string | null;
  status: string;
  dueDate: string | null;
  direction: string | null;
  transferGroupId: string | null;
  installmentNo: number | null;
  installmentTotal: number | null;
  accountId: string;
  accountName: string;
  accountColor: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
};

export type FiltroDeLancamentos = {
  de?: string;
  ate?: string;
  accountId?: string;
  categoryId?: string;
  /** Casa com a descrição. */
  busca?: string;
  type?: "income" | "expense" | "transfer";
  status?: "pending" | "cleared";
  limite?: number;
  offset?: number;
};

const colunas = {
  id: transactions.id,
  type: transactions.type,
  amountCents: transactions.amountCents,
  date: transactions.date,
  competenceDate: transactions.competenceDate,
  description: transactions.description,
  notes: transactions.notes,
  status: transactions.status,
  dueDate: transactions.dueDate,
  direction: transactions.direction,
  transferGroupId: transactions.transferGroupId,
  installmentNo: transactions.installmentNo,
  installmentTotal: transactions.installmentTotal,
  accountId: transactions.accountId,
  accountName: accounts.name,
  accountColor: accounts.color,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
};

function condicoes(filtro: FiltroDeLancamentos) {
  const partes = [];

  if (filtro.de) partes.push(gte(transactions.date, filtro.de));
  if (filtro.ate) partes.push(lte(transactions.date, filtro.ate));
  if (filtro.accountId)
    partes.push(eq(transactions.accountId, filtro.accountId));
  if (filtro.categoryId) {
    partes.push(eq(transactions.categoryId, filtro.categoryId));
  }
  if (filtro.type) partes.push(eq(transactions.type, filtro.type));
  if (filtro.status) partes.push(eq(transactions.status, filtro.status));
  // `ilike` e não `like`: buscar "mercado" tem que achar "Mercado".
  if (filtro.busca) {
    partes.push(ilike(transactions.description, `%${filtro.busca}%`));
  }

  return partes.length > 0 ? and(...partes) : undefined;
}

export async function listarLancamentos(
  { userId, workspaceId }: ContextoDaSessao,
  filtro: FiltroDeLancamentos = {},
): Promise<Lancamento[]> {
  const { limite = 50, offset = 0 } = filtro;

  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select(colunas)
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      // `left` porque transferência não tem categoria — um inner join aqui
      // faria as transferências sumirem da lista sem erro nenhum.
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(condicoes(filtro))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limite)
      .offset(offset),
  );
}

export async function contarLancamentos(
  { userId, workspaceId }: ContextoDaSessao,
  filtro: FiltroDeLancamentos = {},
): Promise<number> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(transactions)
      .where(condicoes(filtro));

    return linha?.n ?? 0;
  });
}

export type NovoLancamento = {
  accountId: string;
  categoryId: string;
  type: "income" | "expense";
  amountCents: Cents;
  date: string;
  competenceDate?: string;
  description: string;
  notes?: string | null;
  status?: "pending" | "cleared";
  dueDate?: string | null;
  tags?: string[] | null;
};

export async function criarLancamento(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovoLancamento,
): Promise<string> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .insert(transactions)
      .values({
        ...dados,
        workspaceId,
        createdBy: userId,
        // Sem fatura de cartão (fase 2), competência e caixa coincidem.
        competenceDate: dados.competenceDate ?? dados.date,
      })
      .returning({ id: transactions.id });

    return linha!.id;
  });
}

export type NovaTransferencia = {
  origemAccountId: string;
  destinoAccountId: string;
  amountCents: Cents;
  date: string;
  description: string;
  notes?: string | null;
};

/**
 * As duas pernas nascem juntas ou não nascem: `withUser` já abre transação, e
 * as duas linhas entram nela. Uma transferência com só a perna de saída
 * apareceria como despesa e faria o patrimônio total encolher sozinho.
 */
export async function criarTransferencia(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovaTransferencia,
): Promise<string> {
  const grupo = randomUUID();

  const comum = {
    workspaceId,
    createdBy: userId,
    type: "transfer" as const,
    amountCents: dados.amountCents,
    date: dados.date,
    competenceDate: dados.date,
    description: dados.description,
    notes: dados.notes ?? null,
    transferGroupId: grupo,
    // Transferência nunca tem categoria: mover dinheiro entre contas próprias
    // não é gasto, e categorizar faria o donut somar mais que a renda.
    categoryId: null,
  };

  await withUser(userId, workspaceId, async (tx) => {
    await tx.insert(transactions).values([
      { ...comum, accountId: dados.origemAccountId, direction: "out" },
      { ...comum, accountId: dados.destinoAccountId, direction: "in" },
    ]);
  });

  return grupo;
}

export async function atualizarLancamento(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  dados: Partial<NovoLancamento>,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.update(transactions).set(dados).where(eq(transactions.id, id));
  });
}

/**
 * Apagar uma perna de transferência apagaria metade de um par e deixaria a
 * outra metade como um lançamento órfão que não bate com nada. Quando a linha
 * tem grupo, o grupo inteiro vai junto.
 */
export async function apagarLancamento(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .select({ grupo: transactions.transferGroupId })
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (!linha) return;

    if (linha.grupo) {
      await tx
        .delete(transactions)
        .where(eq(transactions.transferGroupId, linha.grupo));
      return;
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });
}

/** Marcar como pago: é o que o semáforo da fase 2 vai acionar. */
export async function confirmarLancamento(
  { userId, workspaceId }: ContextoDaSessao,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;

  await withUser(userId, workspaceId, async (tx) => {
    await tx
      .update(transactions)
      .set({ status: "cleared" })
      .where(inArray(transactions.id, [...ids]));
  });
}

export type ResumoDoPeriodo = {
  incomeCents: Cents;
  expenseCents: Cents;
  balanceCents: Cents;
};

/**
 * Receita e despesa de um intervalo. Transferência fica de fora de propósito:
 * ela não é entrada nem saída de dinheiro, só troca de lugar.
 */
export async function resumoDoPeriodo(
  { userId, workspaceId }: ContextoDaSessao,
  de: string,
  ate: string,
): Promise<ResumoDoPeriodo> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income'  then ${transactions.amountCents} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountCents} else 0 end), 0)`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, de),
          lte(transactions.date, ate),
          eq(transactions.status, "cleared"),
        ),
      );

    const incomeCents = parseCents(linha?.income ?? "0");
    const expenseCents = parseCents(linha?.expense ?? "0");

    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    };
  });
}

export type GastoPorCategoria = {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  totalCents: Cents;
};

export async function gastosPorCategoria(
  { userId, workspaceId }: ContextoDaSessao,
  de: string,
  ate: string,
): Promise<GastoPorCategoria[]> {
  return withUser(userId, workspaceId, async (tx) => {
    const linhas = await tx
      .select({
        categoryId: categories.id,
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
        total: sql<string>`sum(${transactions.amountCents})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          eq(transactions.type, "expense"),
          eq(transactions.status, "cleared"),
          gte(transactions.date, de),
          lte(transactions.date, ate),
        ),
      )
      .groupBy(
        categories.id,
        categories.name,
        categories.color,
        categories.icon,
      )
      .orderBy(desc(sql`sum(${transactions.amountCents})`));

    return linhas.map(({ total, ...resto }) => ({
      ...resto,
      totalCents: parseCents(total),
    }));
  });
}

/** As contas a pagar em aberto, mais próximas do vencimento primeiro. */
export async function pendentes(
  { userId, workspaceId }: ContextoDaSessao,
  limite = 10,
): Promise<Lancamento[]> {
  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select(colunas)
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(eq(transactions.status, "pending"))
      .orderBy(asc(transactions.dueDate))
      .limit(limite),
  );
}
