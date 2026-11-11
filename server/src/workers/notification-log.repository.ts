import { and, eq, sql } from "drizzle-orm";

import { notificationLogs } from "../db/schema/notification-logs.js";
import { db } from "../infrastructure/database/index.js";

export const notificationLogRepository = {
  async createIfAbsent(input: {
    organizationId: string | null;
    recipient: string;
    template: string;
    idempotencyKey: string;
  }) {
    const [log] = await db.insert(notificationLogs).values({
      organizationId: input.organizationId,
      channel: "email",
      recipient: input.recipient,
      template: input.template,
      idempotencyKey: input.idempotencyKey,
    }).onConflictDoNothing({
      target: notificationLogs.idempotencyKey,
    }).returning();
    return log ?? null;
  },

  async findByKey(organizationId: string | null, idempotencyKey: string) {
    const [log] = await db.select().from(notificationLogs).where(and(
      organizationId
        ? eq(notificationLogs.organizationId, organizationId)
        : sql`${notificationLogs.organizationId} is null`,
      eq(notificationLogs.idempotencyKey, idempotencyKey),
    )).limit(1);
    return log ?? null;
  },

  async markAttempt(id: string) {
    const [log] = await db.update(notificationLogs).set({
      attempts: sql`${notificationLogs.attempts} + 1`,
    }).where(eq(notificationLogs.id, id)).returning();
    return log ?? null;
  },

  async markSent(id: string) {
    await db.update(notificationLogs).set({
      status: "sent",
      sentAt: new Date(),
      lastError: null,
    }).where(eq(notificationLogs.id, id));
  },

  async markFailed(id: string, error: string) {
    await db.update(notificationLogs).set({
      status: "failed",
      lastError: error.slice(0, 2_000),
    }).where(eq(notificationLogs.id, id));
  },
};
