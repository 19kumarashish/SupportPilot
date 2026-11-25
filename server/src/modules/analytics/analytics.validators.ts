import { z } from "zod";

export const analyticsRanges = ["7d", "30d", "90d"] as const;

export const analyticsOverviewQuerySchema = z
  .object({
    range: z.enum(analyticsRanges).default("30d"),
  })
  .strict();
