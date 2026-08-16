"use server";

import { revalidatePath } from "next/cache";

import { requireSessionContext } from "@/lib/auth/session";
import { buscarConta } from "@/lib/db/queries/accounts";
import {
  apagarLancamento,
  atualizarLancamento,
  confirmarLancamento,
  criarLancamento,
  criarLancamentosEmLote,
  criarTransferencia,
  type NovoLancamento,
} from "@/lib/db/queries/transactions";
import {
  addMonthsClamped,
  cardInvoiceFor,
  generateInstallments,
} from "@/lib/finance";
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

  // Cartão de crédito muda a COMPETÊNCIA: a compra pertence à fatura que a
  // recebe, não ao dia em que aconteceu (§5.1 — o erro nº 1 dos apps no
  // Brasil). O cálculo é do motor puro; aqui só se consulta a conta.
  const conta = await buscarConta(contexto, dados.accountId);
  const ehCartao =
    conta?.type === "credit_card" &&
    conta.closingDay !== null &&
    conta.dueDay !== null;

  const fatura = ehCartao
    ? cardInvoiceFor({
        closingDay: conta.closingDay!,
        dueDay: conta.dueDay!,
        purchaseDate: dados.date,
      })
    : null;

  if (dados.installments <= 1) {
    await criarLancamento(contexto, {
      accountId: dados.accountId,
      categoryId: dados.categoryId,
      type: dados.type,
      amountCents: dados.amount,
      date: dados.date,
      competenceDate: fatura?.competenceDate ?? dados.date,
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

  // Parcelado: o valor digitado é o DA PARCELA (ver o schema), então o total é
  // parcela × N e o allocate devolve N parcelas idênticas — a soma é exata.
  const parcelas = generateInstallments({
    totalCents: dados.amount * dados.installments,
    installmentTotal: dados.installments,
    firstDueDate: dados.date,
  });

  const lote: NovoLancamento[] = parcelas.map((parcela, indice) => {
    const primeira = indice === 0;

    return {
      accountId: dados.accountId,
      categoryId: dados.categoryId,
      type: dados.type,
      amountCents: parcela.amountCents,
      date: parcela.dueDate,
      // No cartão, cada parcela cai numa fatura consecutiva.
      competenceDate: fatura
        ? addMonthsClamped(fatura.competenceDate, indice)
        : parcela.dueDate,
      description: dados.description,
      notes: dados.notes || null,
      // Só a 1ª parcela segue o status escolhido; as futuras nascem pendentes
      // com vencimento — é o que as coloca no semáforo de contas a pagar.
      status: primeira ? dados.status : "pending",
      dueDate: primeira
        ? dados.status === "pending"
          ? dados.dueDate || parcela.dueDate
          : null
        : fatura
          ? addMonthsClamped(fatura.dueDate, indice)
          : parcela.dueDate,
      installmentNo: parcela.installmentNo,
      installmentTotal: parcela.installmentTotal,
    };
  });

  await criarLancamentosEmLote(contexto, lote);

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

  const conta = await buscarConta(contexto, dados.accountId);
  const fatura =
    conta?.type === "credit_card" &&
    conta.closingDay !== null &&
    conta.dueDay !== null
      ? cardInvoiceFor({
          closingDay: conta.closingDay,
          dueDay: conta.dueDay,
          purchaseDate: dados.date,
        })
      : null;

  await atualizarLancamento(contexto, id, {
    accountId: dados.accountId,
    categoryId: dados.categoryId,
    type: dados.type,
    amountCents: dados.amount,
    date: dados.date,
    competenceDate: fatura?.competenceDate ?? dados.date,
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
