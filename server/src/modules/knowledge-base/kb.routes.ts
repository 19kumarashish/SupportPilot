import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { kbService } from "./kb.service.js";
import {
  createArticleSchema,
  createCategorySchema,
  feedbackSchema,
  idParamSchema,
  listArticlesQuerySchema,
  publishArticleSchema,
  searchQuerySchema,
  updateArticleSchema,
  updateCategorySchema,
  versionParamSchema,
} from "./kb.validators.js";

export const kbRouter: Router = Router();
kbRouter.use(requireAuth);

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success || result.data === undefined) throw new AppError(400, "VALIDATION_ERROR", "Invalid data");
  return result.data;
};

kbRouter.get("/categories", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { categories: await kbService.listCategories(organizationId) } });
});

kbRouter.post("/categories", requireRole("admin"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const input = parse(createCategorySchema, request.body);
  const category = await kbService.createCategory(organizationId, userId, {
    name: input.name, slug: input.slug, ...(input.description === undefined ? {} : { description: input.description }), sortOrder: input.sort_order,
  });
  response.status(201).json({ success: true, data: { category } });
});

kbRouter.patch("/categories/:id", requireRole("admin"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const input = parse(updateCategorySchema, request.body);
  const category = await kbService.updateCategory(organizationId, userId, id, {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.slug === undefined ? {} : { slug: input.slug }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.sort_order === undefined ? {} : { sortOrder: input.sort_order }),
  });
  response.json({ success: true, data: { category } });
});

kbRouter.delete("/categories/:id", requireRole("admin"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  await kbService.deleteCategory(organizationId, userId, id);
  response.status(204).send();
});

kbRouter.get("/articles", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const query = parse(listArticlesQuerySchema, request.query);
  const result = await kbService.listArticles(organizationId, {
    page: query.page, limit: query.limit,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.visibility === undefined ? {} : { visibility: query.visibility }),
    ...(query.category_id === undefined ? {} : { categoryId: query.category_id }),
  });
  response.json({ success: true, data: result });
});

kbRouter.post("/articles", requireRole("admin", "agent"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const input = parse(createArticleSchema, request.body);
  const article = await kbService.createArticle(organizationId, userId, {
    title: input.title, slug: input.slug, currentBody: input.current_body,
    visibility: input.visibility, ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
    ...(input.category_id === undefined ? {} : { categoryId: input.category_id }),
  });
  response.status(201).json({ success: true, data: { article } });
});

kbRouter.get("/articles/:id", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const article = await kbService.findArticle(organizationId, id);
  if (!article) throw new AppError(404, "KB_ARTICLE_NOT_FOUND", "Article not found");
  response.json({ success: true, data: { article } });
});

kbRouter.patch("/articles/:id", requireRole("admin", "agent"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const input = parse(updateArticleSchema, request.body);
  const article = await kbService.updateArticle(organizationId, userId, id, {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.slug === undefined ? {} : { slug: input.slug }),
    ...(input.current_body === undefined ? {} : { currentBody: input.current_body }),
    ...(input.excerpt === undefined ? {} : { excerpt: input.excerpt }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    ...(input.category_id === undefined ? {} : { categoryId: input.category_id }),
  });
  response.json({ success: true, data: { article } });
});

kbRouter.post("/articles/:id/publish", requireRole("admin", "agent"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const input = parse(publishArticleSchema, request.body);
  const article = await kbService.publishArticle(organizationId, userId, id, input.change_summary);
  response.json({ success: true, data: { article } });
});

kbRouter.post("/articles/:id/archive", requireRole("admin", "agent"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const article = await kbService.archiveArticle(organizationId, userId, id);
  response.json({ success: true, data: { article } });
});

kbRouter.get("/articles/:id/versions", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  response.json({ success: true, data: { versions: await kbService.listVersions(organizationId, id) } });
});

kbRouter.post("/articles/:id/versions/:versionNumber/restore", requireRole("admin", "agent"), async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const params = parse(versionParamSchema, request.params);
  const input = parse(publishArticleSchema, request.body);
  const article = await kbService.restoreVersion(organizationId, userId, params.id, params.versionNumber, input.change_summary);
  response.json({ success: true, data: { article } });
});

kbRouter.get("/search", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const query = parse(searchQuerySchema, request.query);
  const result = await kbService.searchArticles(organizationId, query.q, query.page, query.limit);
  response.json({ success: true, data: result });
});

kbRouter.post("/articles/:id/feedback", async (request, response) => {
  const { organizationId, userId } = getTenantContext(request);
  const { id } = parse(idParamSchema, request.params);
  const input = parse(feedbackSchema, request.body);
  await kbService.submitFeedback(organizationId, id, input.helpful, input.comment, undefined, userId);
  response.status(201).json({ success: true, data: {} });
});
