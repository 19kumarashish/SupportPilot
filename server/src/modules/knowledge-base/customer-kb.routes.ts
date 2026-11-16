import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../shared/errors/app-error.js";
import { requireCustomerAuth } from "../customers/customer-auth.js";
import type { CustomerAccessRequest } from "../customers/customer-auth.js";
import { kbService } from "./kb.service.js";
import {
  feedbackSchema,
  idParamSchema,
  listArticlesQuerySchema,
  searchQuerySchema,
} from "./kb.validators.js";

export const customerKbRouter: Router = Router();
customerKbRouter.use(requireCustomerAuth);

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid data");
  return result.data;
};

const customer = (request: CustomerAccessRequest) => {
  if (!request.customer) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  return request.customer;
};

customerKbRouter.get("/categories", async (request, response) => {
  const { organizationId } = customer(request as CustomerAccessRequest);
  response.json({ success: true, data: { categories: await kbService.listCategories(organizationId) } });
});

customerKbRouter.get("/articles", async (request, response) => {
  const { organizationId } = customer(request as CustomerAccessRequest);
  const query = parse(listArticlesQuerySchema, request.query);
  const result = await kbService.listArticles(organizationId, {
    page: query.page, limit: query.limit,
    ...(query.category_id === undefined ? {} : { categoryId: query.category_id }),
  }, kbService.customerFilters());
  response.json({ success: true, data: result });
});

customerKbRouter.get("/articles/by-slug/:slug", async (request, response) => {
  const { organizationId } = customer(request as CustomerAccessRequest);
  const slug = parse(z.object({ slug: z.string().min(1).max(500) }), request.params).slug;
  const article = await kbService.findArticleBySlug(organizationId, slug, kbService.customerFilters());
  if (!article) throw new AppError(404, "KB_ARTICLE_NOT_FOUND", "Article not found");
  response.json({ success: true, data: { article } });
});

customerKbRouter.get("/articles/:id", async (request, response) => {
  const { organizationId } = customer(request as CustomerAccessRequest);
  const { id } = parse(idParamSchema, request.params);
  const article = await kbService.findArticle(organizationId, id, kbService.customerFilters());
  if (!article) throw new AppError(404, "KB_ARTICLE_NOT_FOUND", "Article not found");
  response.json({ success: true, data: { article } });
});

customerKbRouter.get("/search", async (request, response) => {
  const { organizationId } = customer(request as CustomerAccessRequest);
  const query = parse(searchQuerySchema, request.query);
  const result = await kbService.searchArticles(organizationId, query.q, query.page, query.limit, kbService.customerFilters());
  response.json({ success: true, data: result });
});

customerKbRouter.post("/articles/:id/feedback", async (request, response) => {
  const { organizationId, id: customerId } = customer(request as CustomerAccessRequest);
  const { id } = parse(idParamSchema, request.params);
  const input = parse(feedbackSchema, request.body);
  await kbService.submitFeedback(organizationId, id, input.helpful, input.comment, customerId, undefined, ["public", "customers_only"]);
  response.status(201).json({ success: true, data: {} });
});
