import { z } from "zod";

const loginCredentialsSchema = {
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
};

export const loginSchema = z.union([
  z.object({
    ...loginCredentialsSchema,
    organizationId: z.uuid(),
  }).strict(),
  z.object({
    ...loginCredentialsSchema,
    organizationSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(63)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict(),
]);

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

export const organizationSignupSchema = z.object({
  organizationName: z.string().trim().min(1).max(255),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
}).strict();

export const verifyOrganizationSignupSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export const resendOrganizationSignupVerificationSchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
}).strict();

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OrganizationSignupInput = z.infer<typeof organizationSignupSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ResendOrganizationSignupVerificationInput = z.infer<
  typeof resendOrganizationSignupVerificationSchema
>;