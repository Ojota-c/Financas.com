"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import {
  apagarLancamento,
  atualizarLancamento,
  confirmarLancamento,
  criarLancamento,
  criarTransferencia,
} from "@/lib/db/queries/transactions";
import {
  transactionSchema,
  transferSchema,
  type TransactionInput,
  type TransferInput,
} from "@/lib/validators/finance";

export type ActionResult = { ok: true } | { error: string };

/**
 * As telas revalidadas por qualquer escrita de lançamento.
 *
 * O extrato muda o saldo, que muda o dashboard e a lista de contas — as três
 * derivam da mesma tabela, então revalidar só a de origem deixaria as outras
 * duas mostrando número velho.
 */
function revalidarTudoQueDependeDoExtrato() {
  revalidatePath("/transacoes");
  revalidatePath("/dashboard");
  revalidatePath("/contas");
}

function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}

export async function criarLancamentoAction(
  valores: TransactionInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = transactionSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  await criarLancamento(contexto, {
    accountId: dados.accountId,
    categoryId: dados.categoryId,
    type: dados.type,
    amountCents: dados.amount,
    date: dados.date,
    description: dados.description,
    notes: dados.notes || null,
    status: dados.status,
    // O CHECK do banco exige vencimento quando está pendente, e o schema já
    // garantiu que ele veio.
    dueDate: dados.status === "pending" ? dados.dueDate || null : null,
  });

  revalidarTudoQueDependeDoExtrato();

  return { ok: true };
}

export async function atualizarLancamentoAction(
  id: string,
  valores: TransactionInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = transactionSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  await atualizarLancamento(contexto, id, {
    accountId: dados.accountId,
    categoryId: dados.categoryId,
    type: dados.type,
    amountCents: dados.amount,
    date: dados.date,
    competenceDate: dados.date,
    description: dados.description,
    notes: dados.notes || null,
    status: dados.status,
    dueDate: dados.status === "pending" ? dados.dueDate || null : null,
  });

  revalidarTudoQueDependeDoExtrato();

  return { ok: true };
}

export async function criarTransferenciaAction(
  valores: TransferInput,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  const parsed = transferSchema.safeParse(valores);
  if (!parsed.success) return { error: primeiroErro(parsed.error.issues) };

  const dados = parsed.data;

  await criarTransferencia(contexto, {
    origemAccountId: dados.origemAccountId,
    destinoAccountId: dados.destinoAccountId,
    amountCents: dados.amount,
    date: dados.date,
    description: dados.description,
  });

  revalidarTudoQueDependeDoExtrato();

  return { ok: true };
}

export async function apagarLancamentoAction(
  id: string,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await apagarLancamento(contexto, id);

  revalidarTudoQueDependeDoExtrato();

  return { ok: true };
}

/** Marcar como pago, do semáforo de contas a pagar. */
export async function confirmarLancamentoAction(
  id: string,
): Promise<ActionResult> {
  const contexto = await requireSessionContext();

  await confirmarLancamento(contexto, [id]);

  revalidarTudoQueDependeDoExtrato();

  return { ok: true };
}
