import {
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 200 }).notNull(),

    email: varchar("email", { length: 255 }),

    phone: varchar("phone", { length: 30 }),

    company: varchar("company", { length: 200 }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("customers_organization_id_idx").on(table.organizationId),
    index("customers_organization_email_idx").on(
      table.organizationId,
      table.email,
    ),
  ],
);