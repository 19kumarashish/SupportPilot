import { z } from "zod";

export const loginSchema = z.object({
  organizationId: z.uuid(),

  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8)
    .max(128),
});

export const registerSchema = z.object({
  organizationId: z.uuid(),

  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8)
    .max(128),

  firstName: z
    .string()
    .trim()
    .min(1)
    .max(100),

  lastName: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;