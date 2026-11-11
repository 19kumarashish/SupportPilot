import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";

export const notificationChannels = ["email"] as const;
export const notificationStatuses = ["pending", "sent", "failed"] as const;

export const notificationChannelEnum = pgEnum(
  "notification_channel",
  notificationChannels,
);
export const notificationStatusEnum = pgEnum(
  "notification_status",
  notificationStatuses,
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    template: varchar("template", { length: 100 }).notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_logs_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("notification_logs_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("notification_logs_status_idx").on(table.status, table.createdAt),
  ],
);
