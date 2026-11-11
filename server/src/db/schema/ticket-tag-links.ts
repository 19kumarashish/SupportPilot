import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tickets } from "./tickets.js";
import { ticketTags } from "./ticket-tags.js";

export const ticketTagLinks = pgTable("ticket_tag_links", {
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => ticketTags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ticket_tag_links_unique").on(table.ticketId, table.tagId),
]);
