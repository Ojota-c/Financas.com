import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { accounts } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { parseCents, type Cents } from "@/lib/finance";

export type ContextoDaSessao = { userId: string; workspaceId: string };

export type Conta = {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  color: string | null;
  icon: string | null;
  initialBalanceCents: Cents;
  creditLimitCents: Cents | null;
  closingDay: number | null;
  dueDay: number | null;
  isArchived: boolean;
  /** Saldo atual: saldo inicial mais o que já compensou. */
  balanceCents: Cents;
};

/**
 * Saldo não é coluna — é o extrato somado (ver o comentário de `accounts`).
 *
 * Só o que está `cleared` entra: uma conta a pagar ainda não saiu da conta, e
 * incluí-la faria o saldo mostrar dinheiro que a pessoa ainda tem.
 *
 * Transferência não tem `type` de sinal, tem `direction` — a perna 'in' soma no
 * destino e a 'out' subtrai na origem, que é o que faz o par não alterar o
 * patrimônio total.
 *
 * **Os nomes são qualificados à mão, e não interpolados.** O Drizzle serializa
 * `${accounts.id}` como `"id"`, sem o prefixo da tabela. Numa subquery
 * correlacionada isso resolve contra a tabela INTERNA: a condição vira
 * `t.account_id = t.id`, nunca casa, e o saldo devolve o valor inicial de todo
 * mundo sem erro nenhum — some o extrato inteiro do cálculo e nada reclama.
 * Foi assim que este arquivo nasceu, e os testes de saldo abaixo são o que
 * pegou.
 */
const saldoCalculado = sql<string>`
  accounts.initial_balance_cents + coalesce((
    select sum(
      case
        when t.type = 'income'    then  t.amount_cents
        when t.type = 'expense'   then -t.amount_cents
        when t.direction = 'in'   then  t.amount_cents
        else                           -t.amount_cents
      end
    )
    from transactions t
    where t.account_id = accounts.id
      and t.status = 'cleared'
  ), 0)
`;

const colunas = {
  id: accounts.id,
  name: accounts.name,
  type: accounts.type,
  institution: accounts.institution,
  color: accounts.color,
  icon: accounts.icon,
  initialBalanceCents: accounts.initialBalanceCents,
  creditLimitCents: accounts.creditLimitCents,
  closingDay: accounts.closingDay,
  dueDay: accounts.dueDay,
  isArchived: accounts.isArchived,
  balanceCents: saldoCalculado,
};

export async function listarContas(
  { userId, workspaceId }: ContextoDaSessao,
  { incluirArquivadas = false } = {},
): Promise<Conta[]> {
  return withUser(userId, workspaceId, async (tx) => {
    const linhas = await tx
      .select(colunas)
      .from(accounts)
      .where(incluirArquivadas ? undefined : eq(accounts.isArchived, false))
      .orderBy(asc(accounts.sortOrder), asc(accounts.name));

    // O saldo vem de um `sum()`, que o driver entrega como string — o
    // customType só cobre a coluna, não a expressão.
    return linhas.map((linha) => ({
      ...linha,
      balanceCents: parseCents(linha.balanceCents),
    }));
  });
}

export async function buscarConta(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
): Promise<Conta | null> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .select(colunas)
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);

    if (!linha) return null;

    return { ...linha, balanceCents: parseCents(linha.balanceCents) };
  });
}

export type NovaConta = {
  name: string;
  type: string;
  institution?: string | null;
  color?: string | null;
  icon?: string | null;
  initialBalanceCents: Cents;
  creditLimitCents?: Cents | null;
  closingDay?: number | null;
  dueDay?: number | null;
};

export async function criarConta(
  { userId, workspaceId }: ContextoDaSessao,
  dados: NovaConta,
): Promise<string> {
  return withUser(userId, workspaceId, async (tx) => {
    const [linha] = await tx
      .insert(accounts)
      .values({ ...dados, workspaceId })
      .returning({ id: accounts.id });

    return linha!.id;
  });
}

export async function atualizarConta(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  dados: Partial<NovaConta>,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx.update(accounts).set(dados).where(eq(accounts.id, id));
  });
}

/**
 * Arquivar, e não apagar: a conta some das telas e o histórico continua de pé.
 * A FK de `transactions.account_id` recusaria o delete de qualquer forma — aqui
 * a intenção fica explícita em vez de virar erro de banco na cara do usuário.
 */
export async function arquivarConta(
  { userId, workspaceId }: ContextoDaSessao,
  id: string,
  arquivada = true,
): Promise<void> {
  await withUser(userId, workspaceId, async (tx) => {
    await tx
      .update(accounts)
      .set({ isArchived: arquivada })
      .where(and(eq(accounts.id, id)));
  });
}

/** Soma dos saldos — o número do topo do dashboard. */
export async function saldoConsolidado(
  contexto: ContextoDaSessao,
): Promise<Cents> {
  const contas = await listarContas(contexto);

  return contas.reduce((total, conta) => total + conta.balanceCents, 0);
}
