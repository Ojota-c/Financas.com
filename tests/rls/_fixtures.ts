import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { expect } from "vitest";

import { dbAuth } from "@/lib/db/client";

/**
 * Fixtures das suítes de isolamento.
 *
 * Tudo aqui escreve por `dbAuth`, que é dona das tabelas e ignora a RLS — é o
 * único jeito de montar o cenário do "outro usuário" sem depender da própria
 * regra que está sendo testada. A leitura, nos testes, é sempre por `dbApp`
 * via `withUser`.
 */

export type Pessoa = {
  userId: string;
  /** O workspace pessoal, criado pelo trigger do cadastro. */
  workspaceId: string;
  email: string;
};

export async function criarPessoa(nome: string): Promise<Pessoa> {
  const email = `${nome.toLowerCase()}-${randomUUID()}@teste.local`;

  const perfil = await dbAuth.execute(sql`
    insert into profiles (name, email, email_verified)
    values (${nome}, ${email}, true)
    returning id
  `);

  const userId = String(perfil.rows[0]!.id);

  // O workspace pessoal e as 65 categorias vêm dos triggers, não daqui.
  const workspace = await dbAuth.execute(sql`
    select organization_id from workspace_members where user_id = ${userId}::uuid
  `);

  return {
    userId,
    email,
    workspaceId: String(workspace.rows[0]!.organization_id),
  };
}

/** Um segundo workspace para a mesma pessoa — o cenário da fase 4. */
export async function criarWorkspaceCompartilhado(
  userId: string,
  nome: string,
): Promise<string> {
  const workspace = await dbAuth.execute(sql`
    insert into workspaces (name, slug, type)
    values (${nome}, ${`ws-${randomUUID()}`}, 'shared')
    returning id
  `);

  const workspaceId = String(workspace.rows[0]!.id);

  await dbAuth.execute(sql`
    insert into workspace_members (organization_id, user_id, role)
    values (${workspaceId}::uuid, ${userId}::uuid, 'owner')
  `);

  return workspaceId;
}

export async function criarConta(
  workspaceId: string,
  nome = "Conta corrente",
): Promise<string> {
  const conta = await dbAuth.execute(sql`
    insert into accounts (workspace_id, name, type)
    values (${workspaceId}::uuid, ${nome}, 'checking')
    returning id
  `);

  return String(conta.rows[0]!.id);
}

/** Uma categoria folha de despesa, das 65 que o trigger copiou. */
export async function categoriaFolha(workspaceId: string): Promise<string> {
  const categoria = await dbAuth.execute(sql`
    select id from categories
    where workspace_id = ${workspaceId}::uuid
      and parent_id is not null
      and kind = 'expense'
    order by sort_order
    limit 1
  `);

  return String(categoria.rows[0]!.id);
}

export async function criarTransacao(
  workspaceId: string,
  contaId: string,
  categoriaId: string,
  descricao: string,
  amountCents = 1000,
): Promise<string> {
  const transacao = await dbAuth.execute(sql`
    insert into transactions
      (workspace_id, account_id, category_id, type, amount_cents, date, competence_date, description)
    values
      (${workspaceId}::uuid, ${contaId}::uuid, ${categoriaId}::uuid, 'expense',
       ${amountCents}, '2026-08-12', '2026-08-12', ${descricao})
    returning id
  `);

  return String(transacao.rows[0]!.id);
}

/**
 * Apaga workspaces antes de perfis: o cascade de `workspace_id` leva contas,
 * lançamentos, categorias e membros junto, e sem isso cada execução da suíte
 * deixaria lixo acumulado no banco de desenvolvimento.
 */
export async function limpar(
  workspaceIds: readonly string[],
  emails: readonly string[],
): Promise<void> {
  for (const id of workspaceIds) {
    await dbAuth.execute(sql`delete from workspaces where id = ${id}::uuid`);
  }

  for (const email of emails) {
    await dbAuth.execute(sql`delete from profiles where email = ${email}`);
  }
}

/**
 * O Drizzle embrulha o erro do Postgres num DrizzleQueryError cuja mensagem é
 * só "Failed query: ...". A recusa da policy fica no `cause`, então procurar na
 * mensagem de cima daria falso negativo — e um teste de isolamento que passa
 * por engano é pior do que não existir.
 */
export async function recusadoPelaRls(
  promessa: Promise<unknown>,
): Promise<void> {
  const cadeia = await mensagensDoErro(promessa);

  expect(cadeia).toMatch(/row-level security/i);
}

/** Mesma leitura de `cause`, para as constraints do schema. */
export async function recusadoPor(
  promessa: Promise<unknown>,
  padrao: RegExp,
): Promise<void> {
  const cadeia = await mensagensDoErro(promessa);

  expect(cadeia).toMatch(padrao);
}

async function mensagensDoErro(promessa: Promise<unknown>): Promise<string> {
  let capturado: unknown;

  try {
    await promessa;
  } catch (erro) {
    capturado = erro;
  }

  expect(capturado, "a query deveria ter sido recusada").toBeDefined();

  const cadeia: string[] = [];
  let atual = capturado;
  while (atual instanceof Error) {
    cadeia.push(atual.message);
    atual = atual.cause;
  }

  return cadeia.join(" | ");
}
