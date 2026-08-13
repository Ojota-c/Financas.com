import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { profiles, workspaces } from "./auth";
import { categories } from "./categories";
import { cents } from "./cents-column";
import { recurring_rules } from "./recurring";

/**
 * O extrato. É a tabela em torno da qual o app inteiro gira.
 *
 * Três decisões estruturais valem o comentário:
 *
 * 1. **`amount_cents` é sempre positivo.** O sinal vem de `type`, não do valor.
 *    Guardar despesa como negativo parece prático até a primeira soma que
 *    esquece o filtro e devolve um número que não é receita nem despesa.
 *
 * 2. **Transferência são DUAS linhas**, unidas por `transfer_group_id` e
 *    distinguidas por `direction`. Uma linha só com conta de origem e destino
 *    quebraria todo extrato por conta, todo saldo e todo filtro — que passariam
 *    a ter que conhecer o caso especial. Duas linhas são lançamentos normais em
 *    toda query, e transferência não polui receita nem despesa porque `type`
 *    já a separa.
 *
 * 3. **`date` é caixa, `competence_date` é competência.** A fatura de cartão
 *    depende disso: a compra de 28/03 que cai na fatura de abril tem `date` em
 *    março e competência em abril. Sem as duas, ou o extrato mente ou o
 *    orçamento mente.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    /**
     * Conta e categoria se ARQUIVAM, não se apagam: sumir com histórico
     * financeiro por um clique em "excluir conta" é perda de dado que o
     * usuário não consegue reconstruir.
     *
     * `no action` e não `restrict`, e a diferença importa exatamente uma vez:
     * ao apagar um workspace inteiro. Os dois proíbem apagar conta com
     * lançamento, mas `restrict` é checado no instante do delete, então
     * dependeria de o cascade de `workspace_id` limpar as transações ANTES de
     * o cascade limpar as contas — ordem que o Postgres decide pela ordem de
     * criação das constraints, não pela nossa. `no action` é checado no fim do
     * statement, quando os dois cascades já rodaram, e o resultado deixa de
     * depender de sorte.
     */
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "no action" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "no action",
    }),

    type: text("type").notNull(),
    amountCents: cents("amount_cents").notNull(),

    date: date("date").notNull(),
    competenceDate: date("competence_date").notNull(),

    description: text("description").notNull(),
    notes: text("notes"),

    // 'pending' é o "a pagar" da fase 2; 'cleared' já afetou o saldo.
    status: text("status").notNull().default("cleared"),
    dueDate: date("due_date"),

    transferGroupId: uuid("transfer_group_id"),
    direction: text("direction"),

    recurringRuleId: uuid("recurring_rule_id").references(
      () => recurring_rules.id,
      { onDelete: "set null" },
    ),
    installmentNo: integer("installment_no"),
    installmentTotal: integer("installment_total"),

    // Fase 4: o que o membro deixa visível no workspace compartilhado.
    sharedVisible: boolean("shared_visible").notNull().default(true),
    tags: text("tags").array(),

    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Os índices do §4.2, e nenhum a mais: índice não usado custa em toda
    // escrita e o extrato é a tabela que mais escreve.

    // A lista padrão: extrato do workspace, mais recente primeiro.
    index("transactions_workspace_date_idx").on(
      table.workspaceId,
      table.date.desc(),
    ),
    // Donut de categorias, orçamento e relatório por período.
    index("transactions_workspace_category_date_idx").on(
      table.workspaceId,
      table.categoryId,
      table.date,
    ),
    // O semáforo de contas a pagar. Parcial porque 'pending' é minoria
    // permanente: o índice fica pequeno mesmo com o extrato grande.
    index("transactions_workspace_pending_due_idx")
      .on(table.workspaceId, table.dueDate)
      .where(sql`${table.status} = 'pending'`),
    // Achar a outra perna da transferência.
    index("transactions_transfer_group_idx")
      .on(table.transferGroupId)
      .where(sql`${table.transferGroupId} is not null`),
    index("transactions_account_id_idx").on(table.accountId),

    check(
      "transactions_type_check",
      sql`${table.type} in ('income', 'expense', 'transfer')`,
    ),

    // O sinal é do `type`; o valor nunca é negativo nem zero.
    check("transactions_amount_check", sql`${table.amountCents} > 0`),

    check(
      "transactions_status_check",
      sql`${table.status} in ('pending', 'cleared')`,
    ),

    /**
     * Transferência tem grupo e direção; o resto não tem nem um nem outro. Sem
     * este check, uma perna órfã de transferência entra no extrato como um
     * lançamento que não soma com nada e não bate com nada.
     */
    check(
      "transactions_transfer_shape_check",
      sql`
        (${table.type} = 'transfer'
          and ${table.transferGroupId} is not null
          and ${table.direction} in ('in', 'out'))
        or (${table.type} <> 'transfer'
          and ${table.transferGroupId} is null
          and ${table.direction} is null)
      `,
    ),

    /**
     * Receita e despesa exigem categoria; transferência não pode ter. Mover
     * dinheiro entre contas próprias não é gasto, e categorizar isso é o erro
     * que faz o donut somar mais do que a pessoa ganhou.
     */
    check(
      "transactions_category_shape_check",
      sql`
        (${table.type} = 'transfer' and ${table.categoryId} is null)
        or (${table.type} <> 'transfer' and ${table.categoryId} is not null)
      `,
    ),

    /**
     * Parcela é "n de N": ou vêm os dois, ou nenhum.
     *
     * Os `is not null` são obrigatórios e não decorativos: `1 between 1 and
     * null` devolve NULL, e um CHECK que devolve NULL PASSA. Sem eles, "parcela
     * 1 de nenhuma" entraria no banco.
     */
    check(
      "transactions_installment_check",
      sql`
        (${table.installmentNo} is null and ${table.installmentTotal} is null)
        or (${table.installmentNo} is not null
            and ${table.installmentTotal} is not null
            and ${table.installmentTotal} > 1
            and ${table.installmentNo} between 1 and ${table.installmentTotal})
      `,
    ),

    // Se está 'pending', tem vencimento — é o que o semáforo ordena.
    check(
      "transactions_due_date_check",
      sql`${table.status} <> 'pending' or ${table.dueDate} is not null`,
    ),
  ],
);
