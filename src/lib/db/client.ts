import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/lib/validators/server-env";

/**
 * Dois pools, duas roles, dois níveis de privilégio.
 *
 * `dbAuth`  → role aurum_auth, dona das tabelas, IGNORA a RLS. Exclusiva do
 *             Better Auth: durante o login ainda não existe usuário para a
 *             policy avaliar, então a autenticação não pode viver sob RLS.
 *
 * `dbApp`   → role aurum_app, não é dona de nada, a RLS SE APLICA. Todo dado de
 *             domínio passa por aqui — e sempre via withUser(), que é quem
 *             informa ao banco de quem é a sessão.
 *
 * Nenhum dos dois deve ser importado fora de `src/lib/db/`. O ESLint barra:
 * usar `dbApp` sem `withUser` é rodar query sem sujeito, e sem sujeito a policy
 * devolve zero linha — o bug apareceria como "sumiu tudo", não como vazamento.
 */

// O dev server do Next reavalia os módulos a cada hot reload. Sem este cache, cada
// alteração de arquivo abriria um pool novo e o Postgres ficaria sem conexão em
// poucos minutos.
const poolCache = globalThis as unknown as {
  __aurumPoolAuth?: Pool;
  __aurumPoolApp?: Pool;
};

function pool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

const poolAuth = (poolCache.__aurumPoolAuth ??= pool(serverEnv.DATABASE_URL));
const poolApp = (poolCache.__aurumPoolApp ??= pool(serverEnv.DATABASE_URL_APP));

export const dbAuth = drizzle(poolAuth);
export const dbApp = drizzle(poolApp);
