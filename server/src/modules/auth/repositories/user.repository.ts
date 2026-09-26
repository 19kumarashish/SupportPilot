import { and, eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";

export const userRepository = {
  // Token authentication resolves users before tenant context is available.
  async findById(id: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] ?? null;
  },

  async findByIdInOrganization(organizationId: string, userId: string) {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.id, userId),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  },

  async findByEmail(organizationId: string, email: string) {
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.email, email),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  },

  async create(data: typeof users.$inferInsert) {
    const result = await db
      .insert(users)
      .values(data)
      .returning();

    return result[0];
  },

  async updateInOrganization(
    organizationId: string,
    userId: string,
    data: Partial<
      Omit<typeof users.$inferInsert, "id" | "organizationId">
    >,
  ) {
    const result = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.id, userId),
        ),
      )
      .returning();

    return result[0] ?? null;
  },

  async deleteInOrganization(organizationId: string, userId: string) {
    const result = await db
      .delete(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.id, userId),
        ),
      )
      .returning({ id: users.id });

    return result[0] ?? null;
  },
};