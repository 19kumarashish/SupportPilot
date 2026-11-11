import { createHash } from "node:crypto";

import { emailProvider, shouldQueueEmailNotifications } from "../modules/auth/services/email-provider.js";
import {
  getEmailQueue,
  getSlaQueue,
} from "./queues.js";

export type EmailJob =
  | {
      kind: "verification";
      organizationId: null;
      to: string;
      verificationUrl: string;
      expiresAt: string;
      idempotencyKey: string;
    }
  | {
      kind: "ticket";
      organizationId: string;
      to: string;
      ticketId: string;
      subject: string;
      body: string;
      idempotencyKey: string;
    }
  | {
      kind: "sla-breach";
      organizationId: string;
      to: string;
      ticketId: string;
      subject: string;
      breachedAt: string;
      idempotencyKey: string;
    }
  | {
      kind: "invitation";
      organizationId: string;
      to: string;
      invitationUrl: string;
      expiresAt: string;
      idempotencyKey: string;
    };

export const makeIdempotencyKey = (
  kind: string,
  organizationId: string,
  resourceId: string,
): string => {
  const digest = createHash("sha256")
    .update(`${kind}:${organizationId}:${resourceId}`)
    .digest("hex");
  return `${kind}:${organizationId}:${digest}`;
};

export const enqueueEmailJob = async (job: EmailJob): Promise<boolean> => {
  const queue = getEmailQueue();
  if (!shouldQueueEmailNotifications() || !queue) return false;
  await queue.add(job.kind, job, { jobId: job.idempotencyKey });
  return true;
};

export const deliverVerificationEmail = async (input: {
  organizationId: string;
  to: string;
  verificationUrl: string;
  expiresAt: Date;
}): Promise<void> => {
  const idempotencyKey = makeIdempotencyKey(
    "verification",
    input.organizationId,
    input.verificationUrl,
  );
  const queued = await enqueueEmailJob({
    kind: "verification",
    organizationId: null,
    to: input.to,
    verificationUrl: input.verificationUrl,
    expiresAt: input.expiresAt.toISOString(),
    idempotencyKey,
  });
  if (!queued) await emailProvider.sendVerificationEmail(input);
};

export const deliverInvitationEmail = async (input: {
  organizationId: string;
  to: string;
  invitationUrl: string;
  expiresAt: Date;
}): Promise<void> => {
  const idempotencyKey = makeIdempotencyKey("invitation", input.organizationId, input.to.toLowerCase());
  const queued = await enqueueEmailJob({
    kind: "invitation",
    organizationId: input.organizationId,
    to: input.to,
    invitationUrl: input.invitationUrl,
    expiresAt: input.expiresAt.toISOString(),
    idempotencyKey,
  });
  if (!queued) await emailProvider.sendInvitationEmail(input);
};

export const enqueueSlaMonitor = async (): Promise<void> => {
  const queue = getSlaQueue();
  if (!queue) return;
  await queue.add("scan", { requestedAt: new Date().toISOString() }, {
    jobId: `sla-scan:${Math.floor(Date.now() / 60_000)}`,
  });
};
