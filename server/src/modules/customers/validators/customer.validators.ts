import { z } from "zod";

export const customerIdParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(30);

const companySchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

export const createCustomerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    company: companySchema.optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    company: companySchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    {
      message: "At least one field must be provided",
    },
  );

export const customerStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();