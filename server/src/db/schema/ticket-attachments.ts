import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { tickets } from "./tickets.js";
import { users } from "../../infrastructure/database/schema/users.js";

export const attachmentStorageDriver = pgEnum("attachment_storage_driver", [
  "local",
  "s3",
]);
export const attachmentScanStatus = pgEnum("attachment_scan_status", [
  "pending",
  "clean",
  "infected",
]);

export const ticketAttachments = pgTable(
  "ticket_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    originalFilename: varchar("original_filename", { length: 180 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
    storageDriver: attachmentStorageDriver("storage_driver")
      .default("local")
      .notNull(),
    scanStatus: attachmentScanStatus("scan_status").default("clean").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ticket_attachments_ticket_created_idx").on(
      table.ticketId,
      table.createdAt,
      table.id,
    ),
  ],
);
