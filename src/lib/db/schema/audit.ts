import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { profiles, workspaces } from "./auth";

/**
 * Quem mudou o quê, e quando. Existe para o workspace compartilhado da fase 4:
 * quando duas pessoas lançam no mesmo espaço, "esse valor mudou sozinho" tem
 * que ter resposta.
 *
 * `entity_id` não tem FK de propósito — o log precisa sobreviver ao que ele
 * registra. Uma FK apagaria em cascata justamente a linha que conta que algo
 * foi apagado.
 *
 * A policy dá SELECT e INSERT ao membro, e nenhum UPDATE ou DELETE a ninguém:
 * log editável não é log.
 */
export const audit_log = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    diff: jsonb("diff").$type<Record<string, unknown>>(),

    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_workspace_at_idx").on(table.workspaceId, table.at.desc()),
    index("audit_log_entity_idx").on(table.entity, table.entityId),

    check(
      "audit_log_action_check",
      sql`${table.action} in ('create', 'update', 'delete')`,
    ),
  ],
);
