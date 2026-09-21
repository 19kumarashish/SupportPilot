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

  DATABASE_URL: z
    .string()
    .url(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32),
});

export const env = envSchema.parse(process.env);