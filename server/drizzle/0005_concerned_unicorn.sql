ALTER TABLE "tickets" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_organization_assigned_to_idx" ON "tickets" USING btree ("organization_id","assigned_to");