import { and, eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";

export const userRepository = {
  async findById(id: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
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

  async update(
    id: string,
    data: Partial<typeof users.$inferInsert>,
  ) {
    const result = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return result[0] ?? null;
  },

  async delete(id: string) {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    return result[0] ?? null;
  },
};