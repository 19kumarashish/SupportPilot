import { eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { organizations } from "../../../infrastructure/database/schema/organizations.js";
import type { OrganizationResponse } from "../types/organization.types.js";

export const organizationRepository = {
  async findById(
    organizationId: string,
  ): Promise<OrganizationResponse | null> {
    const result = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return result[0] ?? null;
  },
};