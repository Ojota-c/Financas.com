import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces } from "./auth";
import { cents } from "./cents-column";

/**
 * Onde o dinheiro está. Conta corrente, poupança, carteira, cartão, corretora.
 *
 * Saldo NÃO é coluna: é `initial_balance_cents` mais a soma dos lançamentos.
 * Guardar saldo materializado significa mantê-lo em dia a cada insert, update,
 * delete e estorno — e a primeira divergência entre o saldo e o extrato é
 * impossível de auditar depois. Se a soma um dia pesar, vira view materializada
 * com o extrato ainda sendo a verdade.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    institution: text("institution"),
    color: text("color"),
    icon: text("icon"),
    initialBalanceCents: cents("initial_balance_cents").notNull().default(0),

    // Só cartão de crédito usa os três abaixo — ver o check de coerência.
    creditLimitCents: cents("credit_limit_cents"),
    closingDay: integer("closing_day"),
    dueDay: integer("due_day"),

    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("accounts_workspace_id_idx").on(table.workspaceId),

    check(
      "accounts_type_check",
      sql`${table.type} in ('checking', 'savings', 'cash', 'credit_card', 'investment', 'other')`,
    ),

    check(
      "accounts_closing_day_check",
      sql`${table.closingDay} is null or ${table.closingDay} between 1 and 31`,
    ),
    check(
      "accounts_due_day_check",
      sql`${table.dueDay} is null or ${table.dueDay} between 1 and 31`,
    ),

    /**
     * Limite, fechamento e vencimento só existem em cartão de crédito. Sem esta
     * constraint, uma conta corrente com `closing_day` preenchido entra na
     * lógica de fatura da fase 2 e gera competência onde não há fatura nenhuma.
     */
    check(
      "accounts_credit_card_fields_check",
      sql`
        ${table.type} = 'credit_card'
        or (${table.creditLimitCents} is null and ${table.closingDay} is null and ${table.dueDay} is null)
      `,
    ),

    check(
      "accounts_credit_limit_check",
      sql`${table.creditLimitCents} is null or ${table.creditLimitCents} >= 0`,
    ),
  ],
);
