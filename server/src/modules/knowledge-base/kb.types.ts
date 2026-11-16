import type { kbCategories } from "../../db/schema/kb-categories.js";
import type {
  kbArticles,
  kbArticleStatuses,
  kbArticleVisibilities,
} from "../../db/schema/kb-articles.js";
import type { kbArticleVersions } from "../../db/schema/kb-article-versions.js";
import type { kbArticleFeedback } from "../../db/schema/kb-article-feedback.js";

export type KbCategory = typeof kbCategories.$inferSelect;
export type KbArticle = typeof kbArticles.$inferSelect;
export type KbArticleVersion = typeof kbArticleVersions.$inferSelect;
export type KbArticleFeedback = typeof kbArticleFeedback.$inferSelect;

export type KbArticleStatus = (typeof kbArticleStatuses)[number];
export type KbArticleVisibility = (typeof kbArticleVisibilities)[number];

export interface ListArticlesQuery {
  page: number;
  limit: number;
  status?: KbArticleStatus;
  visibility?: KbArticleVisibility;
  categoryId?: string;
}

export interface ListArticlesFilters {
  status?: KbArticleStatus[];
  visibility?: KbArticleVisibility[];
  categoryId?: string;
}

export interface SearchQuery {
  q: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
