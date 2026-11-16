import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { customers } from "./customers.js";
import { kbArticles } from "./kb-articles.js";

export const kbArticleFeedback = pgTable(
  "kb_article_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => kbArticles.id, { onDelete: "cascade" }),
    helpful: boolean("helpful").notNull(),
    comment: text("comment"),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("kb_article_feedback_org_article_idx").on(
      table.organizationId,
      table.articleId,
    ),
  ],
);
