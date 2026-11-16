import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { kbService } from "./kb.service.js";
import { feedbackSchema, searchQuerySchema } from "./kb.validators.js";

export const publicKbRouter: Router = Router();

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid data");
  return result.data;
};

const orgId = async (params: unknown) =>
  kbService.resolvePublicOrganization(parse(z.object({ orgSlug: z.string().min(1).max(100) }), params).orgSlug);

publicKbRouter.get("/articles", async (request, response) => {
  const organizationId = await orgId(request.params);
  const query = parse(searchQuerySchema.pick({ page: true, limit: true }).extend({
    category_id: z.string().uuid().optional(),
  }), request.query);
  const result = await kbService.listArticles(organizationId, {
    page: query.page, limit: query.limit,
    ...(query.category_id === undefined ? {} : { categoryId: query.category_id }),
  }, kbService.publicFilters());
  response.json({ success: true, data: result });
});

publicKbRouter.get("/articles/by-slug/:slug", async (request, response) => {
  const organizationId = await orgId(request.params);
  const slug = parse(z.object({ slug: z.string().min(1).max(500) }), request.params).slug;
  const article = await kbService.findArticleBySlug(organizationId, slug, kbService.publicFilters());
  if (!article) throw new AppError(404, "KB_ARTICLE_NOT_FOUND", "Article not found");
  response.json({ success: true, data: { article } });
});

publicKbRouter.get("/search", async (request, response) => {
  const organizationId = await orgId(request.params);
  const query = parse(searchQuerySchema, request.query);
  const result = await kbService.searchArticles(organizationId, query.q, query.page, query.limit, kbService.publicFilters());
  response.json({ success: true, data: result });
});

publicKbRouter.post("/articles/:id/feedback", async (request, response) => {
  const organizationId = await orgId(request.params);
  const articleId = parse(z.object({ id: z.string().uuid() }), request.params).id;
  const input = parse(feedbackSchema, request.body);
  await kbService.submitFeedback(organizationId, articleId, input.helpful, input.comment, undefined, undefined, ["public"]);
  response.status(201).json({ success: true, data: {} });
});
