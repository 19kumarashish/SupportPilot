import { and, count, eq, gte, inArray, sql, sum } from "drizzle-orm";

import { db } from "../../infrastructure/database/index.js";
import { kbArticleChunks, type InsertKbArticleChunk, type KbArticleChunk } from "../../db/schema/kb-article-chunks.js";
import { kbArticles } from "../../db/schema/kb-articles.js";
import { aiUsageLogs, type AiFeature, type AiUsageLog, type InsertAiUsageLog } from "../../db/schema/ai-usage-logs.js";
import type { KbArticleVisibility } from "../knowledge-base/kb.types.js";

export interface RagChunkResult {
  id: string;
  organizationId: string;
  articleId: string;
  versionNumber: number;
  visibility: KbArticleVisibility;
  chunkIndex: number;
  heading: string | null;
  content: string;
  tokenCount: number;
  createdAt: Date;
  articleSlug: string;
  articleTitle: string;
  score: number;
}

export const ragRepository = {
  async deleteChunksByArticle(organizationId: string, articleId: string): Promise<void> {
    await db
      .delete(kbArticleChunks)
      .where(
        and(
          eq(kbArticleChunks.organizationId, organizationId),
          eq(kbArticleChunks.articleId, articleId),
        ),
      );
  },

  async insertChunks(chunks: InsertKbArticleChunk[]): Promise<KbArticleChunk[]> {
    if (chunks.length === 0) return [];
    return db.insert(kbArticleChunks).values(chunks).returning();
  },

  async searchChunks(
    organizationId: string,
    queryVector: number[],
    visibilityFilter: KbArticleVisibility[],
    limit: number,
  ): Promise<RagChunkResult[]> {
    if (visibilityFilter.length === 0 || queryVector.length === 0) return [];

    const sanitizedVector = queryVector.map((v) => (Number.isFinite(v) ? v : 0));
    const vectorLiteral = `[${sanitizedVector.join(",")}]`;
    const scoreExpr = sql<number>`1 - (${kbArticleChunks.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)})`;

    const rows = await db
      .select({
        id: kbArticleChunks.id,
        organizationId: kbArticleChunks.organizationId,
        articleId: kbArticleChunks.articleId,
        versionNumber: kbArticleChunks.versionNumber,
        visibility: kbArticleChunks.visibility,
        chunkIndex: kbArticleChunks.chunkIndex,
        heading: kbArticleChunks.heading,
        content: kbArticleChunks.content,
        tokenCount: kbArticleChunks.tokenCount,
        createdAt: kbArticleChunks.createdAt,
        articleSlug: kbArticles.slug,
        articleTitle: kbArticles.title,
        score: scoreExpr.as("score"),
      })
      .from(kbArticleChunks)
      .innerJoin(kbArticles, eq(kbArticles.id, kbArticleChunks.articleId))
      .where(
        and(
          eq(kbArticleChunks.organizationId, organizationId),
          eq(kbArticles.organizationId, organizationId),
          eq(kbArticles.status, "published"),
          inArray(kbArticleChunks.visibility, visibilityFilter),
          inArray(kbArticles.visibility, visibilityFilter),
          sql`${kbArticleChunks.embedding} IS NOT NULL`,
        ),
      )
      .orderBy(sql`${scoreExpr} DESC`)
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      score: Number(row.score),
    }));
  },

  async logUsage(data: InsertAiUsageLog): Promise<AiUsageLog> {
    const [log] = await db.insert(aiUsageLogs).values(data).returning();
    if (!log) throw new Error("Failed to insert AI usage log");
    return log;
  },

  async countDailyUsage(
    organizationId: string,
    feature: AiFeature | undefined,
    since: Date,
  ): Promise<{ requests: number; tokens: number }> {
    const conditions = [
      eq(aiUsageLogs.organizationId, organizationId),
      gte(aiUsageLogs.createdAt, since),
    ];
    if (feature) {
      conditions.push(eq(aiUsageLogs.feature, feature));
    }

    const [row] = await db
      .select({
        requests: count(),
        tokens: sum(sql<number>`${aiUsageLogs.promptTokens} + ${aiUsageLogs.completionTokens}`),
      })
      .from(aiUsageLogs)
      .where(and(...conditions));

    return {
      requests: Number(row?.requests ?? 0),
      tokens: Number(row?.tokens ?? 0),
    };
  },
};
