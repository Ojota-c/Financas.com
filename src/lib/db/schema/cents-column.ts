import { customType } from "drizzle-orm/pg-core";

import { parseCents, type Cents } from "@/lib/finance/money";

/**
 * A regra 1 aplicada na fronteira do driver, e não na disciplina de quem
 * escreve query.
 *
 * O `pg` entrega `BIGINT` como string — justamente porque pode não caber num
 * double — e o `mode: "number"` do Drizzle resolveria isso com um `Number()`
 * silencioso, que arredonda em vez de reclamar. Aqui a conversão passa por
 * `parseCents`, então uma coluna de dinheiro corrompida estoura na leitura,
 * perto da causa, em vez de virar saldo errado três telas adiante.
 *
 * Toda coluna monetária do schema usa este tipo. Nenhuma usa `bigint` cru.
 */
export const cents = customType<{ data: Cents; driverData: string }>({
  dataType: () => "bigint",
  fromDriver: (valor) => parseCents(valor),
  toDriver: (valor) => String(parseCents(valor)),
});
