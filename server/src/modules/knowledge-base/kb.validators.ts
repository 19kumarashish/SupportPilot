import { z } from "zod";
import { kbArticleStatuses, kbArticleVisibilities } from "../../db/schema/kb-articles.js";

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().trim().max(1000).optional(),
  sort_order: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

// Article schemas
export const createArticleSchema = z.object({
  title: z.string().trim().min(1).max(500),
  slug: z.string().trim().min(1).max(500).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(500).optional(),
  current_body: z.string().min(1).max(100000),
  status: z.enum(kbArticleStatuses).default("draft"),
  visibility: z.enum(kbArticleVisibilities).default("public"),
  category_id: z.string().uuid().optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

export const publishArticleSchema = z.object({
  change_summary: z.string().trim().max(500).optional(),
});

export const feedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(2000).optional(),
}).strict();

// Query schemas
export const listArticlesQuerySchema = z.object({
  status: z.enum(kbArticleStatuses).optional(),
  visibility: z.enum(kbArticleVisibilities).optional(),
  category_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const versionParamSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().positive(),
});
