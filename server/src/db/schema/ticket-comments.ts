import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tickets } from "./tickets.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { customers } from "./customers.js";

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "restrict" }),
    customerAuthorId: uuid("customer_author_id").references(() => customers.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    editedBy: uuid("edited_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ticket_comments_ticket_created_idx").on(
      table.ticketId,
      table.createdAt,
      table.id,
    ),
  ],
);
