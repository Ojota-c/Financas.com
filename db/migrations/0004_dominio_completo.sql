CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"institution" text,
	"color" text,
	"icon" text,
	"initial_balance_cents" bigint DEFAULT 0 NOT NULL,
	"credit_limit_cents" bigint,
	"closing_day" integer,
	"due_day" integer,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('checking', 'savings', 'cash', 'credit_card', 'investment', 'other')),
	CONSTRAINT "accounts_closing_day_check" CHECK ("accounts"."closing_day" is null or "accounts"."closing_day" between 1 and 31),
	CONSTRAINT "accounts_due_day_check" CHECK ("accounts"."due_day" is null or "accounts"."due_day" between 1 and 31),
	CONSTRAINT "accounts_credit_card_fields_check" CHECK (
        "accounts"."type" = 'credit_card'
        or ("accounts"."credit_limit_cents" is null and "accounts"."closing_day" is null and "accounts"."due_day" is null)
      ),
	CONSTRAINT "accounts_credit_limit_check" CHECK ("accounts"."credit_limit_cents" is null or "accounts"."credit_limit_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"diff" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_action_check" CHECK ("audit_log"."action" in ('create', 'update', 'delete'))
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"period" date NOT NULL,
	"limit_cents" bigint NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_workspace_category_period_key" UNIQUE("workspace_id","category_id","period"),
	CONSTRAINT "budgets_limit_check" CHECK ("budgets"."limit_cents" > 0),
	CONSTRAINT "budgets_period_is_first_day_check" CHECK (extract(day from "budgets"."period") = 1)
);
--> statement-breakpoint
CREATE TABLE "goal_contributions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"date" date NOT NULL,
	"transaction_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_contributions_amount_check" CHECK ("goal_contributions"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_cents" bigint NOT NULL,
	"saved_cents" bigint DEFAULT 0 NOT NULL,
	"target_date" date,
	"account_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"color" text,
	"icon" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_check" CHECK ("goals"."target_cents" > 0),
	CONSTRAINT "goals_saved_check" CHECK ("goals"."saved_cents" >= 0),
	CONSTRAINT "goals_status_check" CHECK ("goals"."status" in ('active', 'reached', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"template" jsonb NOT NULL,
	"frequency" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"day_of_month" integer,
	"weekday" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"occurrences_limit" integer,
	"next_occurrence" date,
	"auto_post" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_frequency_check" CHECK ("recurring_rules"."frequency" in ('daily', 'weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_rules_interval_check" CHECK ("recurring_rules"."interval" > 0),
	CONSTRAINT "recurring_rules_day_of_month_check" CHECK ("recurring_rules"."day_of_month" is null or "recurring_rules"."day_of_month" between 1 and 31),
	CONSTRAINT "recurring_rules_weekday_check" CHECK ("recurring_rules"."weekday" is null or "recurring_rules"."weekday" between 0 and 6),
	CONSTRAINT "recurring_rules_end_date_check" CHECK ("recurring_rules"."end_date" is null or "recurring_rules"."end_date" >= "recurring_rules"."start_date"),
	CONSTRAINT "recurring_rules_occurrences_limit_check" CHECK ("recurring_rules"."occurrences_limit" is null or "recurring_rules"."occurrences_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"date" date NOT NULL,
	"competence_date" date NOT NULL,
	"description" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'cleared' NOT NULL,
	"due_date" date,
	"transfer_group_id" uuid,
	"direction" text,
	"recurring_rule_id" uuid,
	"installment_no" integer,
	"installment_total" integer,
	"shared_visible" boolean DEFAULT true NOT NULL,
	"tags" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('income', 'expense', 'transfer')),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_cents" > 0),
	CONSTRAINT "transactions_status_check" CHECK ("transactions"."status" in ('pending', 'cleared')),
	CONSTRAINT "transactions_transfer_shape_check" CHECK (
        ("transactions"."type" = 'transfer'
          and "transactions"."transfer_group_id" is not null
          and "transactions"."direction" in ('in', 'out'))
        or ("transactions"."type" <> 'transfer'
          and "transactions"."transfer_group_id" is null
          and "transactions"."direction" is null)
      ),
	CONSTRAINT "transactions_category_shape_check" CHECK (
        ("transactions"."type" = 'transfer' and "transactions"."category_id" is null)
        or ("transactions"."type" <> 'transfer' and "transactions"."category_id" is not null)
      ),
	CONSTRAINT "transactions_installment_check" CHECK (
        ("transactions"."installment_no" is null and "transactions"."installment_total" is null)
        or ("transactions"."installment_no" is not null
            and "transactions"."installment_total" is not null
            and "transactions"."installment_total" > 1
            and "transactions"."installment_no" between 1 and "transactions"."installment_total")
      ),
	CONSTRAINT "transactions_due_date_check" CHECK ("transactions"."status" <> 'pending' or "transactions"."due_date" is not null)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_workspace_id_idx" ON "accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_at_idx" ON "audit_log" USING btree ("workspace_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "budgets_workspace_period_idx" ON "budgets" USING btree ("workspace_id","period");--> statement-breakpoint
CREATE INDEX "goal_contributions_goal_id_idx" ON "goal_contributions" USING btree ("goal_id","date");--> statement-breakpoint
CREATE INDEX "goal_contributions_workspace_id_idx" ON "goal_contributions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "goals_workspace_id_idx" ON "goals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "recurring_rules_workspace_id_idx" ON "recurring_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "recurring_rules_next_occurrence_idx" ON "recurring_rules" USING btree ("workspace_id","next_occurrence") WHERE "recurring_rules"."is_active";--> statement-breakpoint
CREATE INDEX "transactions_workspace_date_idx" ON "transactions" USING btree ("workspace_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_workspace_category_date_idx" ON "transactions" USING btree ("workspace_id","category_id","date");--> statement-breakpoint
CREATE INDEX "transactions_workspace_pending_due_idx" ON "transactions" USING btree ("workspace_id","due_date") WHERE "transactions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "transactions_transfer_group_idx" ON "transactions" USING btree ("transfer_group_id") WHERE "transactions"."transfer_group_id" is not null;--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");