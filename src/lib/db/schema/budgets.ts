import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces } from "./auth";
import { categories } from "./categories";
import { cents } from "./cents-column";

/**
 * Teto de gasto por categoria e por mês.
 *
 * `period` é um DATE fixado no dia 1 — não um par (ano, mês). Com data, todo
 * filtro de intervalo, ordenação e comparação com `transactions.date` usa o
 * mesmo tipo e os mesmos operadores; com dois inteiros, cada query vira
 * aritmética de calendário na mão.
 *
 * `rollover` guarda a sobra do mês para o mês seguinte — é o que faz o envelope
 * funcionar de verdade, em vez de zerar o esforço de quem economizou.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    period: date("period").notNull(),
    limitCents: cents("limit_cents").notNull(),
    rollover: boolean("rollover").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // A tela de orçamento lê o mês inteiro de uma vez.
    index("budgets_workspace_period_idx").on(table.workspaceId, table.period),

    unique("budgets_workspace_category_period_key").on(
      table.workspaceId,
      table.categoryId,
      table.period,
    ),

    check("budgets_limit_check", sql`${table.limitCents} > 0`),

    // Sem isto, 'março' e '2 de março' seriam dois orçamentos diferentes e a
    // constraint de unicidade acima não valeria nada.
    check(
      "budgets_period_is_first_day_check",
      sql`extract(day from ${table.period}) = 1`,
    ),
  ],
);
