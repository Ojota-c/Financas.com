"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import {
  arquivarConta,
  atualizarConta,
  criarConta,
  type NovaConta,
} from "@/lib/db/queries/accounts";
import { accountSchema, type AccountInput } from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

type Normalizado = { ok: false; erro: string } | { ok: true; dados: NovaConta };

/**
 * O schema roda de novo aqui, mesmo já tendo rodado no formulário.
 *
 * Não é redundância: o formulário é do cliente e o cliente é território hostil.
 * O que o React Hook Form valida é UX; o que vale é isto.
 */
function normalizar(valores: AccountInput): Normalizado {
  const parsed = accountSchema.safeParse(valores);

  if (!parsed.success) {
    const primeiro = parsed.error.issues[0];
    return { ok: false, erro: primeiro?.message ?? "Dados inválidos." };
  }

  const dados = parsed.data;

  return {
    ok: true,
    dados: {
      name: dados.name,
      type: dados.type,
      institution: dados.institution || null,
      color: dados.color || null,
      initialBalanceCents: dados.initialBalance,
      // Campo de cartão em conta que não é cartão vira NULL — o CHECK do banco
      // recusaria, e o schema já barrou antes de chegar aqui.
      creditLimitCents:
        dados.type === "credit_card" ? (dados.creditLimit ?? null) : null,
      closingDay:
        dados.type === "credit_card" ? (dados.closingDay ?? null) : null,
      dueDay: dados.type === "credit_card" ? (dados.dueDay ?? null) : null,
    },
  };
}

export async function criarContaAction(
  valores: AccountInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();
  const resultado = normalizar(valores);

  if (!resultado.ok) return { error: resultado.erro };

  await criarConta(contexto, resultado.dados);

  revalidatePath("/contas");
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function atualizarContaAction(
  id: string,
  valores: AccountInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();
  const resultado = normalizar(valores);

  if (!resultado.ok) return { error: resultado.erro };

  await atualizarConta(contexto, id, resultado.dados);

  revalidatePath("/contas");
  revalidatePath("/dashboard");

  return { ok: true };
}

export async function arquivarContaAction(
  id: string,
  arquivada: boolean,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await arquivarConta(contexto, id, arquivada);

  revalidatePath("/contas");
  revalidatePath("/dashboard");

  return { ok: true };
}
