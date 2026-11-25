import { env } from "../../config/env.js";
import { chatProvider, embeddingProvider, type Citation } from "../../infrastructure/ai/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { kbRepository } from "../knowledge-base/kb.repository.js";
import type { KbArticleVisibility } from "../knowledge-base/kb.types.js";
import { organizationSettingsRepository } from "../organizations/organization-settings.repository.js";
import { ticketCommentRepository } from "../tickets/comments/comment.repository.js";
import { ticketRepository } from "../tickets/repositories/ticket.repository.js";
import { chunkArticle } from "./kb-chunker.js";
import { ragRepository } from "./rag.repository.js";
import { invalidateTenantAnalytics } from "../analytics/analytics.service.js";

export interface DraftReplyResult {
  draft: string;
  citations: Citation[];
  confidence: number;
}

export interface CustomerAskResult {
  answer?: string;
  citations?: Citation[];
  confidence?: number;
  handedOff: boolean;
  message?: string;
}

const ESCALATION_MESSAGE =
  "I could not find a confident answer in our help center. Please submit a ticket and our support team will assist you.";

export const STAFF_AI_VISIBILITIES: KbArticleVisibility[] = [
  "public",
  "customers_only",
  "internal_staff",
];

export const CUSTOMER_AI_VISIBILITIES: KbArticleVisibility[] = [
  "public",
  "customers_only",
];

export const startOfTodayUtc = (): Date => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const shouldHandOffCustomerAsk = (
  topChunkScore: number | undefined,
  modelConfidence: number | undefined,
  threshold: number = env.AI_CONFIDENCE_THRESHOLD,
): boolean => {
  if (topChunkScore === undefined || topChunkScore < threshold) return true;
  if (modelConfidence !== undefined && modelConfidence < threshold) return true;
  return false;
};

async function ensureAiEnabled(organizationId: string): Promise<void> {
  const settings = await organizationSettingsRepository.getOrCreate(organizationId);
  if (!settings?.aiAssistanceEnabled) {
    throw new AppError(403, "AI_DISABLED", "AI assistance is not enabled for this workspace");
  }
}

async function ensureDailyQuota(organizationId: string): Promise<void> {
  const usage = await ragRepository.countDailyUsage(organizationId, undefined, startOfTodayUtc());
  if (usage.requests >= env.AI_DAILY_REQUEST_LIMIT || usage.tokens >= env.AI_DAILY_TOKEN_LIMIT) {
    throw new AppError(429, "AI_QUOTA_EXCEEDED", "Daily AI quota exceeded for this workspace");
  }
}

export const aiService = {
  async reindexArticle(organizationId: string, articleId: string): Promise<void> {
    const article = await kbRepository.findArticleById(organizationId, articleId);
    await ragRepository.deleteChunksByArticle(organizationId, articleId);
    if (!article || article.status !== "published") {
      return;
    }

    const chunks = chunkArticle(article.title, article.currentBody);
    const embeddings = await embeddingProvider.embedTexts(chunks.map((c) => c.content));

    await ragRepository.insertChunks(
      chunks.map((chunk, index) => ({
        organizationId,
        articleId,
        versionNumber: article.publishedVersionNumber,
        visibility: article.visibility,
        chunkIndex: chunk.chunkIndex,
        heading: chunk.heading,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: embeddings[index] ?? null,
      })),
    );

    await ragRepository.logUsage({
      organizationId,
      actorType: "staff",
      actorId: null,
      ticketId: null,
      feature: "reindex",
      model: env.AI_EMBEDDING_MODEL,
      promptTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      completionTokens: 0,
      confidenceScore: null,
      handedOff: false,
    });
  },

  async draftReply(
    organizationId: string,
    ticketId: string,
    userId: string,
  ): Promise<DraftReplyResult> {
    await ensureAiEnabled(organizationId);
    await ensureDailyQuota(organizationId);

    const ticket = await ticketRepository.findByIdInOrganization(organizationId, ticketId);
    if (!ticket) {
      throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    }

    const recentComments = await ticketCommentRepository.listInOrganization(
      organizationId,
      ticketId,
      { page: 1, limit: 10 },
      true,
    );

    const threadContext = [
      `Subject: ${ticket.subject}`,
      `Description: ${ticket.description}`,
      ...recentComments.items.map((comment) =>
        `${comment.isInternal ? "[Internal Note]" : "[Reply]"}: ${comment.body}`,
      ),
    ].join("\n\n");

    const [queryVector] = await embeddingProvider.embedTexts([threadContext]);
    if (!queryVector) {
      throw new AppError(500, "AI_EMBEDDING_FAILED", "Failed to generate query embedding");
    }

    const chunks = await ragRepository.searchChunks(
      organizationId,
      queryVector,
      STAFF_AI_VISIBILITIES,
      8,
    );

    const reply = await chatProvider.generateGroundedReply({
      systemPrompt:
        "Draft a clear, polite, accurate support reply for the agent based on the ticket thread and knowledge base sources.",
      userMessage: threadContext,
      chunks: chunks.map((chunk) => ({
        heading: chunk.heading,
        content: chunk.content,
        articleId: chunk.articleId,
        slug: chunk.articleSlug,
        title: chunk.articleTitle,
        score: chunk.score,
      })),
    });

    await ragRepository.logUsage({
      organizationId,
      actorType: "staff",
      actorId: userId,
      ticketId,
      feature: "agent_draft",
      model: env.AI_CHAT_MODEL,
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
      confidenceScore: reply.confidence.toFixed(4),
      handedOff: false,
    });
    void invalidateTenantAnalytics(organizationId);

    return {
      draft: reply.answer,
      citations: reply.citations,
      confidence: reply.confidence,
    };
  },

  async customerAsk(
    organizationId: string,
    customerId: string,
    question: string,
  ): Promise<CustomerAskResult> {
    await ensureAiEnabled(organizationId);
    await ensureDailyQuota(organizationId);

    const [queryVector] = await embeddingProvider.embedTexts([question]);
    if (!queryVector) {
      throw new AppError(500, "AI_EMBEDDING_FAILED", "Failed to generate query embedding");
    }

    const chunks = await ragRepository.searchChunks(
      organizationId,
      queryVector,
      CUSTOMER_AI_VISIBILITIES,
      5,
    );

    const topScore = chunks[0]?.score;
    if (shouldHandOffCustomerAsk(topScore, undefined)) {
      await ragRepository.logUsage({
        organizationId,
        actorType: "customer",
        actorId: customerId,
        ticketId: null,
        feature: "customer_qa",
        model: env.AI_CHAT_MODEL,
        promptTokens: 0,
        completionTokens: 0,
        confidenceScore: topScore !== undefined ? topScore.toFixed(4) : null,
        handedOff: true,
      });

      return {
        handedOff: true,
        message: ESCALATION_MESSAGE,
      };
    }

    const reply = await chatProvider.generateGroundedReply({
      systemPrompt:
        "Answer the customer's question concisely using only the provided public and customer-visible knowledge base sources.",
      userMessage: question,
      chunks: chunks.map((chunk) => ({
        heading: chunk.heading,
        content: chunk.content,
        articleId: chunk.articleId,
        slug: chunk.articleSlug,
        title: chunk.articleTitle,
        score: chunk.score,
      })),
    });

    const handedOff = shouldHandOffCustomerAsk(topScore, reply.confidence);

    await ragRepository.logUsage({
      organizationId,
      actorType: "customer",
      actorId: customerId,
      ticketId: null,
      feature: "customer_qa",
      model: env.AI_CHAT_MODEL,
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
      confidenceScore: reply.confidence.toFixed(4),
      handedOff,
    });
    void invalidateTenantAnalytics(organizationId);

    if (handedOff) {
      return {
        handedOff: true,
        message: ESCALATION_MESSAGE,
      };
    }

    return {
      answer: reply.answer,
      citations: reply.citations,
      confidence: reply.confidence,
      handedOff: false,
    };
  },
};
