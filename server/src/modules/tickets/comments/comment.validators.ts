import { z } from "zod";

export const ticketCommentsParamsSchema = z
  .object({ id: z.uuid() })
  .strict();

export const createTicketCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(10_000),
    isInternal: z.boolean().default(false),
  })
  .strict();

export const listTicketCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type CreateTicketCommentInput = z.infer<
  typeof createTicketCommentSchema
>;
export type ListTicketCommentsQuery = z.infer<
  typeof listTicketCommentsQuerySchema
>;
