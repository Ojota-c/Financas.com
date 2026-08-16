"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import { definirOrcamento, removerOrcamento } from "@/lib/db/queries/budgets";
import { budgetSchema, type BudgetInput } from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}

export async function definirOrcamentoAction(
  valores: BudgetInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = budgetSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  await definirOrcamento(contexto, {
    categoryId: parsed.data.categoryId,
    period: parsed.data.period,
    limitCents: parsed.data.limit,
    rollover: parsed.data.rollover,
  });

  // O dashboard vai mostrar aderência ao orçamento; revalidar junto evita
  // teto novo com card velho.
  revalidatePath("/orcamento");
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function removerOrcamentoAction(
  id: string,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await removerOrcamento(contexto, id);

  revalidatePath("/orcamento");
  revalidatePath("/dashboard");

  return { ok: true };
}
