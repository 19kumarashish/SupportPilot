import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { kbArticles, kbArticleVisibilityEnum } from "./kb-articles.js";

// Custom pgvector column type (1536 dimensions for text-embedding-3-small)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

export const kbArticleChunks = pgTable(
  "kb_article_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => kbArticles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    visibility: kbArticleVisibilityEnum("visibility").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("kb_article_chunks_article_chunk_unique").on(table.articleId, table.chunkIndex),
    index("kb_article_chunks_org_idx").on(table.organizationId),
  ],
);

export type KbArticleChunk = typeof kbArticleChunks.$inferSelect;
export type InsertKbArticleChunk = typeof kbArticleChunks.$inferInsert;
