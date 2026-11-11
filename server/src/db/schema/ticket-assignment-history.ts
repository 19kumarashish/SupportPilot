import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tickets } from "./tickets.js";
import { users } from "../../infrastructure/database/schema/users.js";

export const ticketAssignmentHistory = pgTable("ticket_assignment_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  assignedFrom: uuid("assigned_from").references(() => users.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("ticket_assignment_history_ticket_idx").on(table.ticketId, table.createdAt),
]);
