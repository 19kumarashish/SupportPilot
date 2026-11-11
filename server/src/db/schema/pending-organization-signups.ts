import {
  index,
  pgTable,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const pendingOrganizationSignups = pgTable(
  "pending_organization_signups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationName: varchar("organization_name", { length: 255 }).notNull(),
    organizationSlug: varchar("organization_slug", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("pending_organization_signups_slug_unique").on(
      table.organizationSlug,
    ),
    uniqueIndex("pending_organization_signups_email_unique").on(table.email),
    index("pending_organization_signups_expires_at_idx").on(table.expiresAt),
  ],
);
