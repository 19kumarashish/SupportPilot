import { z } from "zod";

export const draftReplyParamSchema = z.object({
  ticketId: z.string().uuid(),
});

export const reindexParamSchema = z.object({
  articleId: z.string().uuid(),
});

export const customerAskSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
  })
  .strict();
