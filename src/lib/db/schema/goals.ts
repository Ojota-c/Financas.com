import { sql } from "drizzle-orm";
import {
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
import { cents } from "./cents-column";
import { transactions } from "./transactions";

/**
 * Cofrinho: "R$ 12.000 até dezembro". O aporte sugerido da fase 3 sai daqui
 * com `target_date`.
 *
 * `saved_cents` é redundante com a soma de `goal_contributions` — e é
 * deliberado, ao contrário do saldo de conta. A diferença é o volume: um
 * cofrinho tem dezenas de aportes, não milhares de lançamentos, e a meta
 * aparece em card de dashboard onde a soma seria feita a cada render. O trigger
 * da migration mantém as duas em dia na mesma transação, então não há janela
 * para divergirem.
 */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    targetCents: cents("target_cents").notNull(),
    savedCents: cents("saved_cents").notNull().default(0),
    targetDate: date("target_date"),

    // Onde o dinheiro da meta mora de fato, quando mora em algum lugar.
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),

    priority: integer("priority").notNull().default(0),
    color: text("color"),
    icon: text("icon"),
    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("goals_workspace_id_idx").on(table.workspaceId),

    check("goals_target_check", sql`${table.targetCents} > 0`),
    check("goals_saved_check", sql`${table.savedCents} >= 0`),
    check(
      "goals_status_check",
      sql`${table.status} in ('active', 'reached', 'paused', 'archived')`,
    ),
  ],
);

/**
 * Cada aporte (ou resgate) de uma meta.
 *
 * `workspace_id` existe aqui mesmo sendo derivável de `goal_id`: a regra 3 não
 * abre exceção, e sem a coluna a policy teria que fazer join com `goals` a cada
 * linha avaliada — que é o custo que a RLS cobra caro.
 *
 * `amount_cents` pode ser negativo: resgatar da reserva é um evento normal, e
 * apagar o aporte para "desfazer" apagaria o histórico de que houve resgate.
 */
export const goal_contributions = pgTable(
  "goal_contributions",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),

    amountCents: cents("amount_cents").notNull(),
    date: date("date").notNull(),

    // Quando o aporte veio de um lançamento real do extrato.
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),

    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("goal_contributions_goal_id_idx").on(table.goalId, table.date),
    index("goal_contributions_workspace_id_idx").on(table.workspaceId),

    check("goal_contributions_amount_check", sql`${table.amountCents} <> 0`),
  ],
);
