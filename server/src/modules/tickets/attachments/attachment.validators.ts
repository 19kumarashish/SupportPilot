import { z } from "zod";

export const ticketAttachmentParamsSchema = z
  .object({ id: z.uuid() })
  .strict();

export const ticketAttachmentDownloadParamsSchema = z
  .object({ id: z.uuid(), attachmentId: z.uuid() })
  .strict();

export const listTicketAttachmentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type ListTicketAttachmentsQuery = z.infer<
  typeof listTicketAttachmentsQuerySchema
>;
