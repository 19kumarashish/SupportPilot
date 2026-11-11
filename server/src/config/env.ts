import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z
    .coerce
    .number()
    .int()
    .positive()
    .default(5000),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  REQUEST_BODY_LIMIT: z.string().default("1mb"),

  REDIS_URL: z.string().url().optional(),

  EMAIL_PROVIDER: z.enum(["http"]).optional(),
  EMAIL_API_URL: z.string().url().optional(),
  EMAIL_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  ENABLE_ASYNC_NOTIFICATIONS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  DATABASE_URL: z
    .string()
    .url(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32),
  PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
}).superRefine((values, context) => {
  if (
    values.NODE_ENV === "production" &&
    !process.env.PUBLIC_APP_URL
  ) {
    context.addIssue({
      code: "custom",
      path: ["PUBLIC_APP_URL"],
      message: "PUBLIC_APP_URL is required in production",
    });
  }
});

export const env = envSchema.parse(process.env);