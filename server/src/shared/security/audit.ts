import type { Request } from "express";
import { db } from "../../infrastructure/database/index.js";
import { auditEvents } from "../../infrastructure/database/schema/audit-events.js";

export interface AuditInput {
  organizationId?: string;
  actorUserId?: string;
  eventType: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export const recordAuditEvent = async (
  input: AuditInput,
  request?: Request,
) => db.insert(auditEvents).values({
  organizationId: input.organizationId ?? null,
  actorUserId: input.actorUserId ?? null,
  eventType: input.eventType,
  resourceType: input.resourceType,
  resourceId: input.resourceId ?? null,
  metadata: input.metadata ?? null,
  ipAddress: request?.socket.remoteAddress ?? null,
  userAgent: request?.get("user-agent") ?? null,
});
