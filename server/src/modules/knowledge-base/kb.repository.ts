import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../infrastructure/database/index.js";
import { kbArticleFeedback } from "../../db/schema/kb-article-feedback.js";
import { kbArticleVersions } from "../../db/schema/kb-article-versions.js";
import { kbArticles } from "../../db/schema/kb-articles.js";
import { kbCategories } from "../../db/schema/kb-categories.js";
import type {
  KbArticle,
  KbArticleFeedback,
  KbArticleVersion,
  KbArticleVisibility,
  KbCategory,
  ListArticlesFilters,
  ListArticlesQuery,
  PaginatedResult,
} from "./kb.types.js";

const articleConditions = (
  organizationId: string,
  filters: ListArticlesFilters = {},
) => {
  const conditions = [eq(kbArticles.organizationId, organizationId)];
  if (filters.status?.length) conditions.push(inArray(kbArticles.status, filters.status));
  if (filters.visibility?.length) conditions.push(inArray(kbArticles.visibility, filters.visibility));
  if (filters.categoryId) conditions.push(eq(kbArticles.categoryId, filters.categoryId));
  return conditions;
};

export const kbRepository = {
  async listCategories(organizationId: string): Promise<KbCategory[]> {
    return db.select().from(kbCategories)
      .where(eq(kbCategories.organizationId, organizationId))
      .orderBy(asc(kbCategories.sortOrder), asc(kbCategories.name));
  },

  async createCategory(
    organizationId: string,
    data: { name: string; slug: string; description?: string; sortOrder?: number },
  ): Promise<KbCategory> {
    const [category] = await db.insert(kbCategories).values({
      organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    }).returning();
    if (!category) throw new Error("Category creation failed");
    return category;
  },

  async updateCategory(
    organizationId: string,
    id: string,
    data: { name?: string; slug?: string; description?: string; sortOrder?: number },
  ): Promise<KbCategory | null> {
    const [category] = await db.update(kbCategories).set({
      ...(data.name === undefined ? {} : { name: data.name }),
      ...(data.slug === undefined ? {} : { slug: data.slug }),
      ...(data.description === undefined ? {} : { description: data.description }),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
      updatedAt: new Date(),
    }).where(and(eq(kbCategories.organizationId, organizationId), eq(kbCategories.id, id))).returning();
    return category ?? null;
  },

  async deleteCategory(organizationId: string, id: string): Promise<KbCategory | null> {
    const [category] = await db.delete(kbCategories)
      .where(and(eq(kbCategories.organizationId, organizationId), eq(kbCategories.id, id)))
      .returning();
    return category ?? null;
  },

  async listArticles(
    organizationId: string,
    query: ListArticlesQuery,
    filters: ListArticlesFilters = {},
  ): Promise<PaginatedResult<KbArticle>> {
    const queryFilters: ListArticlesFilters = {
      ...(filters.status || query.status ? { status: query.status ? [query.status] : filters.status } : {}),
      ...(filters.visibility || query.visibility ? { visibility: query.visibility ? [query.visibility] : filters.visibility } : {}),
      ...(filters.categoryId || query.categoryId ? { categoryId: query.categoryId ?? filters.categoryId } : {}),
    };
    const where = and(...articleConditions(organizationId, queryFilters));
    const [items, countRows] = await Promise.all([
      db.select().from(kbArticles).where(where)
        .orderBy(desc(kbArticles.updatedAt)).limit(query.limit).offset((query.page - 1) * query.limit),
      db.select({ total: count() }).from(kbArticles).where(where),
    ]);
    return { items, total: Number(countRows[0]?.total ?? 0) };
  },

  async findArticleById(
    organizationId: string,
    id: string,
    filters: ListArticlesFilters = {},
  ): Promise<KbArticle | null> {
    const [article] = await db.select().from(kbArticles)
      .where(and(...articleConditions(organizationId, filters), eq(kbArticles.id, id)));
    return article ?? null;
  },

  async findArticleBySlug(
    organizationId: string,
    slug: string,
    filters: ListArticlesFilters = {},
  ): Promise<KbArticle | null> {
    const [article] = await db.select().from(kbArticles)
      .where(and(...articleConditions(organizationId, filters), eq(kbArticles.slug, slug)));
    return article ?? null;
  },

  async createArticle(
    organizationId: string,
    authorId: string,
    data: {
      title: string;
      slug: string;
      excerpt?: string;
      currentBody: string;
      visibility: KbArticleVisibility;
      categoryId?: string;
    },
  ): Promise<KbArticle> {
    const [article] = await db.insert(kbArticles).values({
      organizationId,
      authorId,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? null,
      currentBody: data.currentBody,
      visibility: data.visibility,
      categoryId: data.categoryId ?? null,
    }).returning();
    if (!article) throw new Error("Article creation failed");
    return article;
  },

  async updateArticle(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      currentBody?: string;
      visibility?: KbArticleVisibility;
      categoryId?: string;
    },
  ): Promise<KbArticle | null> {
    const [article] = await db.update(kbArticles).set({
      ...(data.title === undefined ? {} : { title: data.title }),
      ...(data.slug === undefined ? {} : { slug: data.slug }),
      ...(data.excerpt === undefined ? {} : { excerpt: data.excerpt }),
      ...(data.currentBody === undefined ? {} : { currentBody: data.currentBody }),
      ...(data.visibility === undefined ? {} : { visibility: data.visibility }),
      ...(data.categoryId === undefined ? {} : { categoryId: data.categoryId }),
      updatedAt: new Date(),
    }).where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, id))).returning();
    return article ?? null;
  },

  async listVersions(organizationId: string, articleId: string): Promise<KbArticleVersion[]> {
    return db.select().from(kbArticleVersions)
      .where(and(eq(kbArticleVersions.organizationId, organizationId), eq(kbArticleVersions.articleId, articleId)))
      .orderBy(desc(kbArticleVersions.versionNumber));
  },

  async searchArticles(
    organizationId: string,
    query: string,
    page: number,
    limit: number,
    filters: ListArticlesFilters = {},
  ): Promise<PaginatedResult<KbArticle & { rank: number }>> {
    const vector = sql`to_tsvector('english', ${kbArticles.title} || ' ' || coalesce(${kbArticles.currentBody}, ''))`;
    const tsQuery = sql`plainto_tsquery('english', ${query})`;
    const rank = sql<number>`ts_rank(${vector}, ${tsQuery})`;
    const where = and(...articleConditions(organizationId, filters), sql`${vector} @@ ${tsQuery}`);
    const [items, countRows] = await Promise.all([
      db.select({ article: kbArticles, rank }).from(kbArticles).where(where)
        .orderBy(desc(rank)).limit(limit).offset((page - 1) * limit),
      db.select({ total: count() }).from(kbArticles).where(where),
    ]);
    return {
      items: items.map(({ article, rank: articleRank }) => ({ ...article, rank: Number(articleRank) })),
      total: Number(countRows[0]?.total ?? 0),
    };
  },

  async createFeedback(
    organizationId: string,
    data: { articleId: string; helpful: boolean; comment?: string; customerId?: string; userId?: string },
  ): Promise<KbArticleFeedback> {
    const [feedback] = await db.insert(kbArticleFeedback).values({
      organizationId,
      articleId: data.articleId,
      helpful: data.helpful,
      comment: data.comment ?? null,
      customerId: data.customerId ?? null,
      userId: data.userId ?? null,
    }).returning();
    if (!feedback) throw new Error("Feedback creation failed");
    return feedback;
  },

  async incrementFeedbackCount(
    organizationId: string,
    articleId: string,
    helpful: boolean,
  ): Promise<void> {
    await db.update(kbArticles).set(
      helpful
        ? { helpfulCount: sql`${kbArticles.helpfulCount} + 1` }
        : { notHelpfulCount: sql`${kbArticles.notHelpfulCount} + 1` },
    ).where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId)));
  },

  async publishArticle(
    organizationId: string,
    articleId: string,
    editorId: string,
    changeSummary?: string,
  ): Promise<KbArticle> {
    return db.transaction(async (transaction) => {
      const [article] = await transaction.select().from(kbArticles)
        .where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId)));
      if (!article) return null;
      const versionNumber = article.publishedVersionNumber + 1;
      const [updated] = await transaction.update(kbArticles).set({
        status: "published",
        publishedVersionNumber: versionNumber,
        publishedAt: article.publishedAt ?? new Date(),
        updatedAt: new Date(),
      }).where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId))).returning();
      await transaction.insert(kbArticleVersions).values({
        organizationId, articleId, versionNumber, title: article.title, body: article.currentBody,
        editedByUserId: editorId, changeSummary: changeSummary ?? null,
      });
      return updated;
    }).then((article) => {
      if (!article) throw new Error("Article not found");
      return article;
    });
  },

  async archiveArticle(organizationId: string, articleId: string, editorId: string): Promise<KbArticle> {
    return db.transaction(async (transaction) => {
      const [article] = await transaction.select().from(kbArticles)
        .where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId)));
      if (!article) return null;
      const versionNumber = article.publishedVersionNumber + 1;
      const [updated] = await transaction.update(kbArticles).set({
        status: "archived", publishedVersionNumber: versionNumber, updatedAt: new Date(),
      }).where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId))).returning();
      await transaction.insert(kbArticleVersions).values({
        organizationId, articleId, versionNumber, title: article.title, body: article.currentBody,
        editedByUserId: editorId, changeSummary: "archived",
      });
      return updated;
    }).then((article) => {
      if (!article) throw new Error("Article not found");
      return article;
    });
  },

  async restoreVersion(
    organizationId: string,
    articleId: string,
    versionNumber: number,
    editorId: string,
    changeSummary?: string,
  ): Promise<KbArticle> {
    return db.transaction(async (transaction) => {
      const [version] = await transaction.select().from(kbArticleVersions).where(and(
        eq(kbArticleVersions.organizationId, organizationId),
        eq(kbArticleVersions.articleId, articleId),
        eq(kbArticleVersions.versionNumber, versionNumber),
      ));
      const [article] = await transaction.select().from(kbArticles)
        .where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId)));
      if (!version || !article) return null;
      const nextVersion = article.publishedVersionNumber + 1;
      const [updated] = await transaction.update(kbArticles).set({
        title: version.title, currentBody: version.body, status: "published",
        publishedVersionNumber: nextVersion, publishedAt: article.publishedAt ?? new Date(), updatedAt: new Date(),
      }).where(and(eq(kbArticles.organizationId, organizationId), eq(kbArticles.id, articleId))).returning();
      await transaction.insert(kbArticleVersions).values({
        organizationId, articleId, versionNumber: nextVersion, title: version.title, body: version.body,
        editedByUserId: editorId, changeSummary: changeSummary ?? `Restored from version ${versionNumber}`,
      });
      return updated;
    }).then((article) => {
      if (!article) throw new Error("Article or version not found");
      return article;
    });
  },
};
