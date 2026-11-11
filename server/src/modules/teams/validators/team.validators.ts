import { z } from "zod";

const name = z.string().trim().min(1).max(100);
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const teamIdParamsSchema = z.object({ teamId: z.uuid() }).strict();
export const membershipParamsSchema = z.object({ teamId: z.uuid(), userId: z.uuid() }).strict();
export const createTeamSchema = z.object({
  name,
  slug,
  description: z.string().trim().max(500).nullable().optional(),
}).strict();
export const updateTeamSchema = createTeamSchema.partial().refine((value) => Object.keys(value).length > 0);
export const membershipSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["lead", "member"]).default("member"),
}).strict();
