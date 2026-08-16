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
 * São DUAS variáveis, e a segunda não é conveniência:
 *
 * - `app.user_id`     → quem é. Responde "esta pessoa pode ver isto?"
 * - `app.workspace_id` → onde está. Responde "isto pertence ao espaço aberto?"
 *
 * Sem a segunda, `is_member()` sozinho libera as linhas de TODOS os workspaces
 * do usuário de uma vez, e o recorte do espaço ativo passa a depender de um
 * `where` manual em cada query. Um esquecimento não vaza dado para estranho —
 * vaza o compartilhado dentro do saldo do pessoal, que é erro de extrato e não
 * aparece em teste. Com a variável, quem garante o recorte é o banco.
 *
 * Duas decisões não óbvias, herdadas e ainda válidas:
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
 * Falha fechada nas duas pontas: sem as variáveis, `current_user_id()` e
 * `current_workspace_id()` devolvem NULL, toda comparação vira NULL e a policy
 * não deixa passar linha nenhuma.
 *
 * Informar um `workspaceId` alheio não abre nada: a policy exige as duas
 * cláusulas, e `is_member()` continua barrando o que não é seu.
 */
export async function withUser<T>(
  userId: string,
  workspaceId: string,
  run: (tx: AppTx) => Promise<T>,
): Promise<T> {
  return dbApp.transaction(async (tx) => {
    // As duas variáveis num comando só: com o banco remoto, cada execute é uma
    // viagem de rede inteira, e este caminho roda em TODA query do app.
    await tx.execute(
      sql`select set_config('app.user_id', ${userId}, true),
                 set_config('app.workspace_id', ${workspaceId}, true)`,
    );
    return run(tx);
  });
}

/**
 * A exceção, e o nome é longo de propósito para não ser escolhido por acaso.
 *
 * Existe para o que é do usuário e não de um workspace: listar os espaços dele
 * para o switcher, e ler o próprio perfil. Nesses casos não HÁ workspace ativo
 * ainda — é justamente o que se vai escolher.
 *
 * Tudo que tenha `workspace_id` fica invisível aqui, e isso é o comportamento
 * desejado: sem `app.workspace_id`, as policies de domínio devolvem zero linha.
 * Se uma query some ao trocar para esta função, ela não pertencia a esta função.
 */
export async function withUserAcrossWorkspaces<T>(
  userId: string,
  run: (tx: AppTx) => Promise<T>,
): Promise<T> {
  return dbApp.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return run(tx);
  });
}
