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
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  ATTACHMENT_STORAGE_PATH: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  MALWARE_SCANNER_DRIVER: z.enum(["noop", "http", "clamav"]).default("noop"),
  MALWARE_SCANNER_URL: z.string().url().optional(),
  MALWARE_SCANNER_API_KEY: z.string().min(1).optional(),
  CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
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
  if (values.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const) {
      if (!values[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
  }
  if (
    values.MALWARE_SCANNER_DRIVER === "http" &&
    !values.MALWARE_SCANNER_URL
  ) {
    context.addIssue({
      code: "custom",
      path: ["MALWARE_SCANNER_URL"],
      message: "MALWARE_SCANNER_URL is required for the HTTP malware scanner",
    });
  }
});

export const env = envSchema.parse(process.env);