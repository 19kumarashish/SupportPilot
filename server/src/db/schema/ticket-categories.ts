import { index, pgTable, timestamp, uniqueIndex, uuid, varchar, boolean, text } from "drizzle-orm/pg-core";
import { organizations } from "../../infrastructure/database/schema/organizations.js";

export const ticketCategories = pgTable("ticket_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ticket_categories_org_slug_unique").on(table.organizationId, table.slug),
  index("ticket_categories_org_active_idx").on(table.organizationId, table.isActive),
]);
