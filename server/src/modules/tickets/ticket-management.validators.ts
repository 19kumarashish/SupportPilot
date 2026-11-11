import { z } from "zod";
import { ticketRelationTypes } from "../../db/schema/ticket-relations.js";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
}).strict();

export const relationSchema = z.object({
  relatedTicketId: z.uuid(),
  relationType: z.enum(ticketRelationTypes),
}).strict();
