import { z } from "zod";

import { ticketPriorities } from "../../../db/schema/tickets.js";

export const slaPrioritySchema = z.enum(ticketPriorities);

export const slaPolicyIdParamsSchema = z.object({
  id: z.uuid(),
}).strict();

export const createSlaPolicySchema = z.object({
  name: z.string().trim().min(1).max(100),
  priority: slaPrioritySchema,
  firstResponseMinutes: z.number().int().positive().max(525600),
  resolutionMinutes: z.number().int().positive().max(525600),
  isDefault: z.boolean().default(false),
}).strict();

export const updateSlaPolicySchema = createSlaPolicySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export type CreateSlaPolicyInput = z.infer<typeof createSlaPolicySchema>;
export type UpdateSlaPolicyInput = z.infer<typeof updateSlaPolicySchema>;
