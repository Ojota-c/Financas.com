import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces } from "./auth";

/**
 * Catálogo de categorias padrão do Brasil (§4.4). É a ÚNICA tabela do schema
 * sem `workspace_id`, e a exceção é deliberada: não é dado de usuário, é dado
 * de referência versionado — o molde de onde cada workspace tira a sua cópia.
 *
 * Por isso ela também é a única sem policy: a RLS fica ligada e sem nenhuma
 * regra, então `aurum_app` enxerga zero linhas. Quem lê daqui é o trigger, que
 * roda como `security definer` e pertence a `aurum_auth`.
 *
 * Mudar o catálogo é escrever migration. Isso é proposital: o trigger depende
 * dele, e um seed que "às vezes rodou" criaria contas sem categoria nenhuma.
 */
export const category_templates = pgTable(
  "category_templates",
  {
    slug: text("slug").primaryKey(),
    parentSlug: text("parent_slug"),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    bucket: text("bucket"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check(
      "category_templates_kind_check",
      sql`${table.kind} in ('income', 'expense')`,
    ),
    check(
      "category_templates_bucket_check",
      sql`${table.bucket} is null or ${table.bucket} in ('needs', 'wants', 'savings')`,
    ),
  ],
);

/**
 * Categorias de um workspace. Árvore de dois níveis: pai agrupa, folha recebe
 * lançamento.
 *
 * Cada workspace tem a SUA cópia — daí o usuário renomear, arquivar e
 * recategorizar à vontade sem afetar ninguém. `workspace_id` nunca é NULL.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    // Auto-relacionamento: NULL = é pai. A FK não é declarada aqui porque o
    // Drizzle exigiria um tipo circular; ela entra na migration custom.
    parentId: uuid("parent_id"),
    bucket: text("bucket"),
    color: text("color"),
    icon: text("icon"),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // De qual linha do catálogo esta veio. NULL = criada pelo usuário.
    templateSlug: text("template_slug"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("categories_workspace_id_idx").on(table.workspaceId),
    index("categories_parent_id_idx").on(table.parentId),
    // `nulls not distinct` porque no Postgres NULLs são distintos por padrão, e
    // sem isso dois PAIS de mesmo nome (parent_id NULL) passariam batido.
    unique("categories_workspace_parent_name_key")
      .on(table.workspaceId, table.parentId, table.name)
      .nullsNotDistinct(),

    check("categories_kind_check", sql`${table.kind} in ('income', 'expense')`),

    /**
     * O §4.4 em forma de constraint. O bucket é o que faz o 50/30/20 funcionar
     * sem o usuário configurar nada, e ele só faz sentido em despesa e só na
     * folha — "mercado é necessidade, delivery é desejo, e os dois são
     * Alimentação". Pai não tem bucket; receita não tem bucket.
     */
    check(
      "categories_bucket_check",
      sql`
        (${table.parentId} is null and ${table.bucket} is null)
        or (${table.parentId} is not null and ${table.kind} = 'income' and ${table.bucket} is null)
        or (${table.parentId} is not null and ${table.kind} = 'expense' and ${table.bucket} in ('needs', 'wants', 'savings'))
      `,
    ),
  ],
);
