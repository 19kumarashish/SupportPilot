import { eq } from "drizzle-orm";

import { organizationSettings } from "../../db/schema/organization-settings.js";
import { db } from "../../infrastructure/database/index.js";

const defaults = (organizationId: string) => ({
  organizationId,
  supportEmail: null,
  defaultSlaPolicyId: null,
  autoAssignEnabled: false,
  aiAssistanceEnabled: false,
  timezone: "UTC",
});

export const organizationSettingsRepository = {
  async getOrCreate(organizationId: string) {
    const [existing] = await db.select().from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId)).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(organizationSettings).values(defaults(organizationId)).onConflictDoNothing().returning();
    if (created) return created;
    const [retried] = await db.select().from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId)).limit(1);
    return retried ?? null;
  },

  update(organizationId: string, input: Partial<typeof organizationSettings.$inferInsert>) {
    return db.update(organizationSettings).set({ ...input, updatedAt: new Date() })
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning().then(([settings]) => settings ?? null);
  },
};
