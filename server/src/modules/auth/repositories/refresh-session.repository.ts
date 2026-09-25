import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { refreshSessions } from "../../../infrastructure/database/schema/refresh-sessions.js";

export const refreshSessionRepository = {
  async create(data: typeof refreshSessions.$inferInsert) {
    const result = await db
      .insert(refreshSessions)
      .values(data)
      .returning();

    const session = result[0];

    if (!session) {
      throw new Error("Failed to create refresh session");
    }

    return session;
  },

  async findActiveByTokenHash(tokenHash: string) {
    const result = await db
      .select()
      .from(refreshSessions)
      .where(
        and(
          eq(refreshSessions.tokenHash, tokenHash),
          isNull(refreshSessions.revokedAt),
        ),
      )
      .limit(1);

    return result[0] ?? null;
  },

  async revokeById(id: string) {
    const result = await db
      .update(refreshSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(refreshSessions.id, id))
      .returning();

    return result[0] ?? null;
  },

  async revokeAllForUser(userId: string) {
    const result = await db
      .update(refreshSessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(refreshSessions.userId, userId),
          isNull(refreshSessions.revokedAt),
        ),
      )
      .returning();

    return result;
  },
};