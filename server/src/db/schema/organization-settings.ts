import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { slaPolicies } from "./sla-policies.js";

export const organizationSettings = pgTable("organization_settings", {
  organizationId: uuid("organization_id").primaryKey().references(() => organizations.id, { onDelete: "cascade" }),
  supportEmail: varchar("support_email", { length: 255 }),
  defaultSlaPolicyId: uuid("default_sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
  autoAssignEnabled: boolean("auto_assign_enabled").notNull().default(false),
  aiAssistanceEnabled: boolean("ai_assistance_enabled").notNull().default(false),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
