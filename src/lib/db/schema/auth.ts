import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Tabelas de autenticação e de workspace, geradas pelo CLI do Better Auth
 * (`auth generate`) e ajustadas à mão. Regerar SOBRESCREVE este arquivo — os
 * ajustes abaixo precisam ser reaplicados, então estão todos comentados.
 *
 * Os nomes dos exports acompanham o `modelName` de cada modelo em
 * `src/lib/auth/server.ts`: o drizzleAdapter procura a tabela pela chave do
 * schema, então `workspace_members` não pode virar `workspaceMembers`.
 *
 * `profiles` é a tabela de usuário. Com o Supabase ela era um espelho de
 * `auth.users`, mantido por trigger; agora é a própria — uma tabela e um
 * trigger a menos.
 */

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // AJUSTE: withTimezone em todo carimbo de tempo. A regra do projeto é data
  // civil em DATE e instante em timestamptz; o CLI gera `timestamp` sem fuso,
  // que num app com fuso fixo em America/Sao_Paulo erra por 3 horas.
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  locale: text("locale").default("pt-BR"),
  currency: text("currency").default("BRL"),
  onboardingDone: boolean("onboarding_done").default(false),
});

export const session = pgTable(
  "session",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // AJUSTE: o plugin declara este campo como string genérica e o CLI gera
    // `text`, apontando para uma PK `uuid`. Sem o tipo certo e sem a FK, um
    // workspace apagado deixaria sessões apontando para o vazio. `set null`
    // e não `cascade`: perder o workspace ativo não pode deslogar ninguém.
    activeOrganizationId: uuid("active_organization_id").references(
      () => workspaces.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    // Hash da senha (scrypt). Nunca sai daqui: nenhuma query de domínio tem
    // acesso a esta tabela — aurum_app não recebe grant sobre ela na etapa D.
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  // AJUSTE: defaultNow(). O workspace pessoal nasce de um trigger de banco
  // (etapa D), que insere sem passar pelo Better Auth.
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  metadata: text("metadata"),
  // 'personal' | 'shared'. O CHECK que restringe os valores vive na migration:
  // o Drizzle não tem como expressá-lo a partir de um additionalField.
  type: text("type").default("personal").notNull(),
  icon: text("icon"),
  color: text("color"),
});

export const workspace_members = pgTable(
  "workspace_members",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workspace_members_organization_id_idx").on(table.organizationId),
    // §4.3: is_member() consulta esta tabela em TODA policy. Sem este índice a
    // RLS custa um seq scan por linha lida.
    index("workspace_members_user_id_idx").on(table.userId),
    // AJUSTE: o planejamento previa PK composta (workspace_id, user_id). O
    // Better Auth exige `id` próprio, então a unicidade vira constraint —
    // sem ela o mesmo usuário entra duas vezes no mesmo workspace.
    unique("workspace_members_workspace_user_key").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const workspace_invites = pgTable(
  "workspace_invites",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_invites_organization_id_idx").on(table.organizationId),
    index("workspace_invites_email_idx").on(table.email),
  ],
);

export const profilesRelations = relations(profiles, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(workspace_members),
  invitesSent: many(workspace_invites),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  profile: one(profiles, {
    fields: [session.userId],
    references: [profiles.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  profile: one(profiles, {
    fields: [account.userId],
    references: [profiles.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspace_members),
  invites: many(workspace_invites),
}));

export const workspaceMembersRelations = relations(
  workspace_members,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspace_members.organizationId],
      references: [workspaces.id],
    }),
    profile: one(profiles, {
      fields: [workspace_members.userId],
      references: [profiles.id],
    }),
  }),
);

export const workspaceInvitesRelations = relations(
  workspace_invites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspace_invites.organizationId],
      references: [workspaces.id],
    }),
    inviter: one(profiles, {
      fields: [workspace_invites.inviterId],
      references: [profiles.id],
    }),
  }),
);
