
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
    categoryId: z.uuid().optional(),
    assignedTo: z.union([z.uuid(), z.literal("unassigned")]).optional(),
    assignedTeamId: z.uuid().optional(),
    tagId: z.uuid().optional(),
    search: z.string().trim().max(200).optional(),
    includeArchived: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
    includeDeleted: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
    sortBy: z.enum(["createdAt", "updatedAt", "subject", "priority", "status"]).default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
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
    categoryId: z.union([z.uuid(), z.null()]).optional(),
    assignedTeamId: z.union([z.uuid(), z.null()]).optional(),
    tagIds: z.array(z.uuid()).max(20).optional(),
  })
  .strict();

export const updateTicketSchema = z
  .object({
    customerId: customerIdSchema.optional(),
    subject: subjectSchema.optional(),
    description: descriptionSchema.optional(),
    priority: z.enum(ticketPriorities).optional(),
    categoryId: z.union([z.uuid(), z.null()]).optional(),
    assignedTeamId: z.union([z.uuid(), z.null()]).optional(),
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

export const archiveTicketSchema = z.object({ archived: z.boolean() }).strict();

export const deleteTicketSchema = z.object({ delete: z.boolean().default(true) }).strict();

export const bulkTicketActionSchema = z.object({
  ticketIds: z.array(z.uuid()).min(1).max(100),
  action: z.enum(["assign", "unassign", "status", "priority", "archive", "restore", "delete"]),
  assignedTo: z.union([z.uuid(), z.null()]).optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "assign" && !value.assignedTo) context.addIssue({ code: "custom", message: "assignedTo is required" });
  if (value.action === "status" && !value.status) context.addIssue({ code: "custom", message: "status is required" });
  if (value.action === "priority" && !value.priority) context.addIssue({ code: "custom", message: "priority is required" });
});
