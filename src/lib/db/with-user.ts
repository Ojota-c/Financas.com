import "server-only";

import { sql } from "drizzle-orm";

import { dbApp } from "./client";

export type AppTx = Parameters<Parameters<typeof dbApp.transaction>[0]>[0];

/**
 * Único caminho de leitura e escrita de dado de domínio.
 *
 * No Supabase a RLS funcionava sozinha porque cada request carregava o JWT do
 * usuário. Com banco próprio o app conecta com uma role fixa, então a policy
 * precisa de um sujeito explícito — é o que esta função entrega.
 *
 * Duas decisões não óbvias:
 *
 * 1. `set_config(..., true)` e não `SET`: o `true` é o `is_local`, que desfaz o
 *    valor no fim da transação. Sem ele o ajuste sobreviveria na conexão, e a
 *    próxima requisição a pegar essa conexão do pool leria o banco como se
 *    fosse o usuário anterior.
 *
 * 2. `set_config()` em vez de `SET LOCAL app.user_id = ...`: `SET LOCAL` não
 *    aceita parâmetro, o que obrigaria a concatenar o id na string — injeção de
 *    SQL. `set_config` é função, então aceita bind normalmente.
 *
 * Falha fechada: se a variável não for definida, `current_user_id()` devolve
 * NULL, `is_member()` devolve false e toda query retorna zero linhas.
 */
export async function withUser<T>(
  userId: string,
  run: (tx: AppTx) => Promise<T>,
): Promise<T> {
  return dbApp.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return run(tx);
  });
}
