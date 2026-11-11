import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tickets } from "./tickets.js";
import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";

export const ticketActivities = pgTable("ticket_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ticket_activities_ticket_created_idx").on(table.ticketId, table.createdAt),
  index("ticket_activities_org_ticket_idx").on(table.organizationId, table.ticketId),
]);
