
import { z } from "zod";

import {
  ticketPriorities,
  ticketStatuses,
} from "../../../db/schema/tickets.js";

export const ticketIdParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const listTicketsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(ticketStatuses).optional(),
    priority: z.enum(ticketPriorities).optional(),
    customerId: z.uuid().optional(),
  })
  .strict();

const subjectSchema = z.string().trim().min(1).max(255);
const descriptionSchema = z.string().trim().min(1).max(10_000);
const customerIdSchema = z.uuid();

export const createTicketSchema = z
  .object({
    customerId: customerIdSchema,
    subject: subjectSchema,
    description: descriptionSchema,
    status: z.enum(ticketStatuses).optional(),
    priority: z.enum(ticketPriorities).optional(),
  })
  .strict();

export const updateTicketSchema = z
  .object({
    customerId: customerIdSchema.optional(),
    subject: subjectSchema.optional(),
    description: descriptionSchema.optional(),
    priority: z.enum(ticketPriorities).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const ticketStatusSchema = z
  .object({
    status: z.enum(ticketStatuses),
  })
  .strict();

export const assignTicketSchema = z
  .object({
    assignedTo: z.union([z.uuid(), z.null()]),
  })
  .strict();
