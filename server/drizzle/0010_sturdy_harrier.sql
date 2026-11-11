ALTER TABLE "ticket_comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "portal_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "portal_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "customer_author_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_customer_author_id_customers_id_fk" FOREIGN KEY ("customer_author_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;