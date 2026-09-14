import {
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "./organizations.js";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "agent",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    email: varchar("email", { length: 255 }).notNull(),

    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    firstName: varchar("first_name", { length: 100 }).notNull(),

    lastName: varchar("last_name", { length: 100 }).notNull(),

    role: userRoleEnum("role").notNull().default("agent"),

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
    uniqueIndex("users_organization_email_unique").on(
      table.organizationId,
      table.email,
    ),

    index("users_organization_id_idx").on(table.organizationId),
  ],
);