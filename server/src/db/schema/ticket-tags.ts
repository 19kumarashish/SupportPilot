import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "../../infrastructure/database/schema/organizations.js";

export const ticketTags = pgTable("ticket_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("ticket_tags_org_slug_unique").on(table.organizationId, table.slug),
  index("ticket_tags_org_deleted_idx").on(table.organizationId, table.deletedAt),
]);
