import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces } from "./auth";

/**
 * O molde de um lançamento que se repete: aluguel, salário, assinatura.
 *
 * `template` é jsonb e não um monte de colunas espelhando `transactions` de
 * propósito — a regra guarda o que o lançamento VAI ser, e espelhar a tabela
 * significaria alterar as duas a cada coluna nova. O jsonb é validado por Zod
 * na borda, e a ocorrência gerada é uma transação normal, com FK de volta
 * para cá.
 */
export const recurring_rules = pgTable(
  "recurring_rules",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    template: jsonb("template").$type<Record<string, unknown>>().notNull(),

    frequency: text("frequency").notNull(),
    interval: integer("interval").notNull().default(1),

    // Qual dia da repetição. `day_of_month` para mensal/anual, `weekday` para
    // semanal (0 = domingo, como o `getDay()` do JS e o `dow` do Postgres).
    dayOfMonth: integer("day_of_month"),
    weekday: integer("weekday"),

    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    occurrencesLimit: integer("occurrences_limit"),

    // Onde a geração parou. É o que o job da fase 2 lê para saber o que deve.
    nextOccurrence: date("next_occurrence"),

    // `true` lança direto como 'cleared'; `false` deixa 'pending' para o
    // usuário confirmar. Padrão conservador: nada entra no extrato sozinho.
    autoPost: boolean("auto_post").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("recurring_rules_workspace_id_idx").on(table.workspaceId),
    // O job varre por "o que vence até hoje", e só o que está ativo.
    index("recurring_rules_next_occurrence_idx")
      .on(table.workspaceId, table.nextOccurrence)
      .where(sql`${table.isActive}`),

    check(
      "recurring_rules_frequency_check",
      sql`${table.frequency} in ('daily', 'weekly', 'monthly', 'yearly')`,
    ),
    check("recurring_rules_interval_check", sql`${table.interval} > 0`),
    check(
      "recurring_rules_day_of_month_check",
      sql`${table.dayOfMonth} is null or ${table.dayOfMonth} between 1 and 31`,
    ),
    check(
      "recurring_rules_weekday_check",
      sql`${table.weekday} is null or ${table.weekday} between 0 and 6`,
    ),
    check(
      "recurring_rules_end_date_check",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    check(
      "recurring_rules_occurrences_limit_check",
      sql`${table.occurrencesLimit} is null or ${table.occurrencesLimit} > 0`,
    ),
  ],
);
