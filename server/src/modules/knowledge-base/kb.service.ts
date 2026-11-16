import { AppError } from "../../shared/errors/app-error.js";
import { recordAuditEvent } from "../../shared/security/audit.js";
import { organizationRepository } from "../organizations/repositories/organization.repository.js";
import { kbRepository } from "./kb.repository.js";
import type { KbArticleStatus, KbArticleVisibility, ListArticlesFilters, ListArticlesQuery } from "./kb.types.js";

const notFound = (message: string): AppError => new AppError(404, "KB_NOT_FOUND", message);

export const kbService = {
  async listCategories(organizationId: string) {
    return kbRepository.listCategories(organizationId);
  },

  async findArticle(organizationId: string, id: string, filters?: ListArticlesFilters) {
    return kbRepository.findArticleById(organizationId, id, filters);
  },

  async findArticleBySlug(organizationId: string, slug: string, filters?: ListArticlesFilters) {
    return kbRepository.findArticleBySlug(organizationId, slug, filters);
  },

  async listVersions(organizationId: string, articleId: string) {
    return kbRepository.listVersions(organizationId, articleId);
  },

  async listArticles(organizationId: string, query: ListArticlesQuery, filters?: ListArticlesFilters) {
    return kbRepository.listArticles(organizationId, query, filters);
  },

  async searchArticles(organizationId: string, query: string, page: number, limit: number, filters?: ListArticlesFilters) {
    return kbRepository.searchArticles(organizationId, query, page, limit, filters);
  },

  async createCategory(organizationId: string, actorUserId: string, input: { name: string; slug: string; description?: string; sortOrder?: number }) {
    const category = await kbRepository.createCategory(organizationId, input);
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_category.created", resourceType: "kb_category", resourceId: category.id });
    return category;
  },

  async updateCategory(organizationId: string, actorUserId: string, id: string, input: { name?: string; slug?: string; description?: string; sortOrder?: number }) {
    const category = await kbRepository.updateCategory(organizationId, id, input);
    if (!category) throw notFound("Category not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_category.updated", resourceType: "kb_category", resourceId: id });
    return category;
  },

  async deleteCategory(organizationId: string, actorUserId: string, id: string) {
    const category = await kbRepository.deleteCategory(organizationId, id);
    if (!category) throw notFound("Category not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_category.deleted", resourceType: "kb_category", resourceId: id });
  },

  async createArticle(
    organizationId: string,
    actorUserId: string,
    input: { title: string; slug: string; excerpt?: string; currentBody: string; visibility: KbArticleVisibility; categoryId?: string },
  ) {
    const article = await kbRepository.createArticle(organizationId, actorUserId, input);
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_article.created", resourceType: "kb_article", resourceId: article.id });
    return article;
  },

  async updateArticle(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: { title?: string; slug?: string; excerpt?: string; currentBody?: string; visibility?: KbArticleVisibility; categoryId?: string },
  ) {
    const article = await kbRepository.updateArticle(organizationId, id, input);
    if (!article) throw notFound("Article not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_article.updated", resourceType: "kb_article", resourceId: id });
    return article;
  },

  async publishArticle(organizationId: string, actorUserId: string, id: string, changeSummary?: string) {
    const article = await kbRepository.publishArticle(organizationId, id, actorUserId, changeSummary);
    if (!article) throw notFound("Article not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_article.published", resourceType: "kb_article", resourceId: id });
    return article;
  },

  async archiveArticle(organizationId: string, actorUserId: string, id: string) {
    const article = await kbRepository.archiveArticle(organizationId, id, actorUserId);
    if (!article) throw notFound("Article not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_article.archived", resourceType: "kb_article", resourceId: id });
    return article;
  },

  async restoreVersion(organizationId: string, actorUserId: string, id: string, versionNumber: number, changeSummary?: string) {
    const article = await kbRepository.restoreVersion(organizationId, id, versionNumber, actorUserId, changeSummary);
    if (!article) throw notFound("Article or version not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "kb_article.version_restored", resourceType: "kb_article", resourceId: id, metadata: { versionNumber } });
    return article;
  },

  async submitFeedback(
    organizationId: string,
    articleId: string,
    helpful: boolean,
    comment: string | undefined,
    customerId?: string,
    userId?: string,
    visibility: KbArticleVisibility[] = ["public", "customers_only"],
  ) {
    const article = await kbRepository.findArticleById(organizationId, articleId, { status: ["published"], visibility });
    if (!article) throw notFound("Article not found");
    const feedback = await kbRepository.createFeedback(organizationId, { articleId, helpful, ...(comment === undefined ? {} : { comment }), ...(customerId === undefined ? {} : { customerId }), ...(userId === undefined ? {} : { userId }) });
    await kbRepository.incrementFeedbackCount(organizationId, articleId, helpful);
    return feedback;
  },

  async resolvePublicOrganization(slug: string) {
    const organizationId = await organizationRepository.findIdBySlug(slug);
    if (!organizationId) throw notFound("Workspace not found");
    return organizationId;
  },

  publicFilters(): ListArticlesFilters {
    return { status: ["published"], visibility: ["public"] };
  },

  customerFilters(): ListArticlesFilters {
    return { status: ["published"], visibility: ["public", "customers_only"] };
  },
};

export type KnowledgeBaseArticleStatus = KbArticleStatus;
