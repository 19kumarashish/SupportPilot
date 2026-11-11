ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT organization_id, lower(email) AS normalized_email, count(*) AS matches
      FROM users
      WHERE email IS NOT NULL
      GROUP BY organization_id, lower(email)
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot create case-insensitive user email uniqueness: duplicate emails exist';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_organization_email_lower_unique"
  ON "users" ("organization_id", (lower("email")));
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT organization_id, lower(email) AS normalized_email, count(*) AS matches
      FROM customers
      WHERE email IS NOT NULL AND deleted_at IS NULL
      GROUP BY organization_id, lower(email)
      HAVING count(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot create case-insensitive customer email uniqueness: duplicate emails exist';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_organization_email_lower_unique"
  ON "customers" ("organization_id", (lower("email")))
  WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_signup_email_lower_unique"
  ON "pending_organization_signups" ((lower("email")));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "actor_user_id" uuid,
  "event_type" varchar(100) NOT NULL,
  "resource_type" varchar(100) NOT NULL,
  "resource_id" varchar(100),
  "metadata" jsonb,
  "ip_address" varchar(45),
  "user_agent" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "audit_events"
    ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_org_created_idx" ON "audit_events" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_actor_created_idx" ON "audit_events" ("actor_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_type_created_idx" ON "audit_events" ("event_type", "created_at");
