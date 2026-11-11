import { z } from "zod";

export const organizationSettingsSchema = z.object({
  supportEmail: z.string().trim().email().max(255).nullable(),
  defaultSlaPolicyId: z.uuid().nullable(),
  autoAssignEnabled: z.boolean(),
  aiAssistanceEnabled: z.boolean(),
  timezone: z.string().trim().min(1).max(100),
}).strict();

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
