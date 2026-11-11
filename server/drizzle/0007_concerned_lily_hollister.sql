CREATE TABLE "pending_organization_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"organization_slug" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_organization_signups_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_organization_signups_slug_unique" ON "pending_organization_signups" USING btree ("organization_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_organization_signups_email_unique" ON "pending_organization_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "pending_organization_signups_expires_at_idx" ON "pending_organization_signups" USING btree ("expires_at");