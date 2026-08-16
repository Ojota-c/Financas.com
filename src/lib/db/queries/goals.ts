import "server-only";

import { and, asc, desc, eq, ne } from "drizzle-orm";

import { goal_contributions, goals } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import type { Cents } from "@/lib/finance";

import type { ContextoDaSessao } from "./accounts";

export type Meta = {
  id: string;
  name: string;
  targetCents: Cents;
  savedCents: Cents;
  targetDate: string | null;
  accountId: string | null;
  priority: number;
  color: string | null;
  icon: string | null;
  status: string;
};

export type Aporte = {
  id: string;
  goalId: string;
  amountCents: Cents;
  date: string;
};

const colunas = {
  id: goals.id,
  name: goals.name,
  targetCents: goals.targetCents,
  savedCents: goals.savedCents,
  targetDate: goals.targetDate,
  accountId: goals.accountId,
  priority: goals.priority,
  color: goals.color,
  icon: goals.icon,
  status: goals.status,
};

export async function listarMetas(
  { userId, workspaceId }: ContextoDaSessao,
  { incluirArquivadas = false } = {},
): Promise<Meta[]> {
  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select(colunas)
      .from(goals)
      .where(incluirArquivadas ? undefined : ne(goals.status, "archived"))
      .orderBy(desc(goals.priority), asc(goals.createdAt)),
  );
}

/** O histórico de aportes de uma meta — é o que alimenta a projeção de ritmo. */
export async function listarAportes(
  { userId, workspaceId }: ContextoDaSessao,
  goalId: string,
): Promise<Aporte[]> {
  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select({
        id: goal_contributions.id,
        goalId: goal_contributions.goalId,
        amountCents: goal_contributions.amountCents,
        date: goal_contributions.date,
      })
      .from(goal_contributions)
      .where(eq(goal_contributions.goalId, goalId))
      .orderBy(asc(goal_contributions.date)),
  );
}

export async function listarTodosAportes({
  userId,
  workspaceId,
}: ContextoDaSessao): Promise<Aporte[]> {
  return withUser(userId, workspaceId, async (tx) =>
    tx
      .select({
        id: goal_contributions.id,
        goalId: goal_contributions.goalId,
        amountCents: goal_contributions.amountCents,
        date: goal_contributions.date,
      })
      .from(goal_contributions)
      .orderBy(asc(goal_contributions.date)),
  );
}

export type NovaMeta = {
  name: string;
  targetCents: Cents;
  targetDate?: string | null;
  accountId?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function criarMeta(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovaMeta,
): Promise<string> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .insert(goals)
      .values({ ...dados, workspaceId })
      .returning({ id: goals.id });

    return linha!.id;
  });
}

export async function atualizarMeta(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  dados: Partial<NovaMeta> & { status?: string },
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.update(goals).set(dados).where(eq(goals.id, id));
  });
}

/**
 * O aporte só grava a linha de contribuição: quem soma em `saved_cents` é o
 * trigger da migration, na mesma transação. Somar aqui TAMBÉM duplicaria o
 * valor — o teste de constraints cobre isso.
 *
 * Quando o `saved` alcança o alvo, o status vira 'reached' — a comparação usa o
 * valor DEPOIS do trigger, lido de volta na mesma transação.
 */
export async function aportar(
  { userId, workspaceId }: ContextoDaSessao,
  dados: {
    goalId: string;
    amountCents: Cents;
    date: string;
    transactionId?: string | null;
  },
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.insert(goal_contributions).values({
      ...dados,
      workspaceId,
      createdBy: userId,
    });

    const [meta] = await tx
      .select({ saved: goals.savedCents, target: goals.targetCents })
      .from(goals)
      .where(eq(goals.id, dados.goalId))
      .limit(1);

    if (!meta) return;

    if (meta.saved >= meta.target) {
      await tx
        .update(goals)
        .set({ status: "reached" })
        .where(eq(goals.id, dados.goalId));
      return;
    }

    // Um resgate pode tirar a meta de 'reached' — o caminho de volta existe.
    await tx
      .update(goals)
      .set({ status: "active" })
      .where(and(eq(goals.id, dados.goalId), eq(goals.status, "reached")));
  });
}

export async function apagarMeta(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    // Arquivar preserva o histórico; apagar de verdade é para meta criada por
    // engano, e o cascade leva os aportes junto.
    await tx.delete(goals).where(eq(goals.id, id));
  });
}
