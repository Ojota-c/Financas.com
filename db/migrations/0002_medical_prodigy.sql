CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" uuid,
	"bucket" text,
	"color" text,
	"icon" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"template_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_workspace_parent_name_key" UNIQUE NULLS NOT DISTINCT("workspace_id","parent_id","name"),
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('income', 'expense')),
	CONSTRAINT "categories_bucket_check" CHECK (
        ("categories"."parent_id" is null and "categories"."bucket" is null)
        or ("categories"."parent_id" is not null and "categories"."kind" = 'income' and "categories"."bucket" is null)
        or ("categories"."parent_id" is not null and "categories"."kind" = 'expense' and "categories"."bucket" in ('needs', 'wants', 'savings'))
      )
);
--> statement-breakpoint
CREATE TABLE "category_templates" (
	"slug" text PRIMARY KEY NOT NULL,
	"parent_slug" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"bucket" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_templates_kind_check" CHECK ("category_templates"."kind" in ('income', 'expense')),
	CONSTRAINT "category_templates_bucket_check" CHECK ("category_templates"."bucket" is null or "category_templates"."bucket" in ('needs', 'wants', 'savings'))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_workspace_id_idx" ON "categories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");