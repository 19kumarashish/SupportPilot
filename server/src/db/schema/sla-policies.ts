import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { ticketPriorities } from "./tickets.js";

export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    priority: varchar("priority", { length: 20 }).$type<
      (typeof ticketPriorities)[number]
    >().notNull(),
    firstResponseMinutes: integer("first_response_minutes").notNull(),
    resolutionMinutes: integer("resolution_minutes").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sla_policies_organization_priority_unique").on(
      table.organizationId,
      table.priority,
    ),
    index("sla_policies_organization_default_idx").on(
      table.organizationId,
      table.isDefault,
    ),
  ],
);
