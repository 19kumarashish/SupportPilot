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
import { sql } from "drizzle-orm";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { kbCategories } from "./kb-categories.js";

export const kbArticleStatuses = ["draft", "published", "archived"] as const;
export const kbArticleVisibilities = [
  "public",
  "customers_only",
  "internal_staff",
] as const;

export const kbArticleStatusEnum = pgEnum(
  "kb_article_status",
  kbArticleStatuses,
);
export const kbArticleVisibilityEnum = pgEnum(
  "kb_article_visibility",
  kbArticleVisibilities,
);

export const kbArticles = pgTable(
  "kb_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => kbCategories.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull(),
    excerpt: text("excerpt"),
    currentBody: text("current_body").notNull(),
    status: kbArticleStatusEnum("status").notNull().default("draft"),
    visibility: kbArticleVisibilityEnum("visibility").notNull().default("public"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedVersionNumber: integer("published_version_number")
      .notNull()
      .default(0),
    helpfulCount: integer("helpful_count").notNull().default(0),
    notHelpfulCount: integer("not_helpful_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("kb_articles_org_slug_unique").on(
      table.organizationId,
      table.slug,
    ),
    index("kb_articles_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title} || ' ' || coalesce(${table.currentBody}, ''))`,
    ),
    index("kb_articles_org_status_visibility_idx").on(
      table.organizationId,
      table.status,
      table.visibility,
    ),
  ],
);
