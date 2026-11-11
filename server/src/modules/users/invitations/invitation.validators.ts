import { z } from "zod";

export const invitationIdParamsSchema = z.object({ id: z.uuid() }).strict();
export const invitationTokenSchema = z.object({ token: z.string().trim().min(32).max(200) }).strict();
export const createInvitationSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "agent"]).default("agent"),
  teamId: z.uuid().nullable().optional(),
}).strict();
export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(32).max(200),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
}).strict();
