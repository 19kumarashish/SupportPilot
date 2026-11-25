import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { tickets } from "./tickets.js";

export const aiActorTypeEnum = pgEnum("ai_actor_type", ["staff", "customer"]);
export const aiFeatureEnum = pgEnum("ai_feature", ["agent_draft", "customer_qa", "reindex"]);

export type AiActorType = "staff" | "customer";
export type AiFeature = "agent_draft" | "customer_qa" | "reindex";

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorType: aiActorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    feature: aiFeatureEnum("feature").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }),
    handedOff: boolean("handed_off").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_usage_logs_org_created_idx").on(table.organizationId, table.createdAt),
    index("ai_usage_logs_org_feature_created_idx").on(table.organizationId, table.feature, table.createdAt),
  ],
);

export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogs.$inferInsert;
