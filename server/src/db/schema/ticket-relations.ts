import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tickets } from "./tickets.js";

export const ticketRelationTypes = ["duplicate", "related", "blocks", "blocked_by", "parent", "child"] as const;
export const ticketRelationTypeEnum = pgEnum("ticket_relation_type", ticketRelationTypes);

export const ticketRelations = pgTable("ticket_relations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  relatedTicketId: uuid("related_ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  relationType: ticketRelationTypeEnum("relation_type").notNull().default("related"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ticket_relations_unique").on(table.ticketId, table.relatedTicketId, table.relationType),
]);
