CREATE TYPE "public"."ticket_relation_type" AS ENUM('duplicate', 'related', 'blocks', 'blocked_by', 'parent', 'child');--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "ticket_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "ticket_tag_links" (
	"ticket_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ticket_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ticket_assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"assigned_from" uuid,
	"assigned_to" uuid,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ticket_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"related_ticket_id" uuid NOT NULL,
	"relation_type" "ticket_relation_type" DEFAULT 'related' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tag_links" ADD CONSTRAINT "ticket_tag_links_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tag_links" ADD CONSTRAINT "ticket_tag_links_tag_id_ticket_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."ticket_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_assigned_from_users_id_fk" FOREIGN KEY ("assigned_from") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_relations" ADD CONSTRAINT "ticket_relations_related_ticket_id_tickets_id_fk" FOREIGN KEY ("related_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_categories_org_slug_unique" ON "ticket_categories" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "ticket_categories_org_active_idx" ON "ticket_categories" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tags_org_slug_unique" ON "ticket_tags" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "ticket_tags_org_deleted_idx" ON "ticket_tags" USING btree ("organization_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tag_links_unique" ON "ticket_tag_links" USING btree ("ticket_id","tag_id");--> statement-breakpoint
CREATE INDEX "ticket_activities_ticket_created_idx" ON "ticket_activities" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_activities_org_ticket_idx" ON "ticket_activities" USING btree ("organization_id","ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_assignment_history_ticket_idx" ON "ticket_assignment_history" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_relations_unique" ON "ticket_relations" USING btree ("ticket_id","related_ticket_id","relation_type");
