"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import {
  apagarMeta,
  aportar,
  atualizarMeta,
  criarMeta,
} from "@/lib/db/queries/goals";
import {
  contributionSchema,
  goalSchema,
  type ContributionInput,
  type GoalInput,
} from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}

function revalidarMetas() {
  revalidatePath("/metas");
  // O aporte de meta entra no Safe-to-Spend do dashboard.
  revalidatePath("/dashboard");
}

export async function criarMetaAction(
  valores: GoalInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = goalSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  await criarMeta(contexto, {
    name: dados.name,
    targetCents: dados.target,
    targetDate: dados.targetDate || null,
    accountId: dados.accountId || null,
    color: dados.color || null,
  });

  revalidarMetas();

  return { ok: true };
}

export async function atualizarMetaAction(
  id: string,
  valores: GoalInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = goalSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  await atualizarMeta(contexto, id, {
    name: dados.name,
    targetCents: dados.target,
    targetDate: dados.targetDate || null,
    accountId: dados.accountId || null,
    color: dados.color || null,
  });

  revalidarMetas();

  return { ok: true };
}

export async function aportarAction(
  valores: ContributionInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = contributionSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  await aportar(contexto, {
    goalId: parsed.data.goalId,
    amountCents: parsed.data.amount,
    date: parsed.data.date,
  });

  revalidarMetas();

  return { ok: true };
}

export async function pausarMetaAction(
  id: string,
  pausar: boolean,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await atualizarMeta(contexto, id, { status: pausar ? "paused" : "active" });

  revalidarMetas();

  return { ok: true };
}

export async function apagarMetaAction(id: string): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await apagarMeta(contexto, id);

  revalidarMetas();

  return { ok: true };
}
