import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { customers } from "./customers.js";
import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { ticketCategories } from "./ticket-categories.js";
import { teams } from "./teams.js";

export const ticketStatuses = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const ticketPriorities = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const ticketStatusEnum = pgEnum("ticket_status", ticketStatuses);

export const ticketPriorityEnum = pgEnum("ticket_priority", ticketPriorities);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),

    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedTeamId: uuid("assigned_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => ticketCategories.id, {
      onDelete: "set null",
    }),

    subject: varchar("subject", { length: 255 }).notNull(),

    description: text("description").notNull(),

    status: ticketStatusEnum("status").notNull().default("open"),

    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    firstResponseDeadlineAt: timestamp("first_response_deadline_at", {
      withTimezone: true,
    }),
    resolutionDeadlineAt: timestamp("resolution_deadline_at", {
      withTimezone: true,
    }),
    firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

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
    index("tickets_customer_id_idx").on(table.customerId),

    index("tickets_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),

    index("tickets_organization_priority_idx").on(
      table.organizationId,
      table.priority,
    ),

    index("tickets_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt,
    ),

    index("tickets_organization_assigned_to_idx").on(
      table.organizationId,
      table.assignedTo,
    ),
    index("tickets_organization_assigned_team_idx").on(
      table.organizationId,
      table.assignedTeamId,
    ),
    index("tickets_sla_breach_scan_idx").on(
      table.organizationId,
      table.status,
      table.slaBreachedAt,
      table.resolutionDeadlineAt,
    ),
  ],
);
