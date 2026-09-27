import { z } from "zod";

export const userIdParamsSchema = z.object({
  id: z.uuid(),
}).strict();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

const nameSchema = z.string().trim().min(1).max(100);

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.enum(["admin", "agent"]),
}).strict();

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  role: z.enum(["admin", "agent"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const userStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();