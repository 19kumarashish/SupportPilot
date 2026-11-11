import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { emailProvider } from "../modules/auth/services/email-provider.js";
import { notificationLogRepository } from "./notification-log.repository.js";
import { EMAIL_QUEUE_NAME, getDeadLetterQueues } from "./queues.js";
import type { EmailJob } from "./jobs.js";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Email delivery failed";

export const createEmailNotificationWorker = (): Worker<EmailJob> | null => {
  if (!env.REDIS_URL) return null;
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const worker = new Worker<EmailJob>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJob>) => {
      const existing = await notificationLogRepository.findByKey(
        job.data.organizationId,
        job.data.idempotencyKey,
      );
      if (existing?.status === "sent") return;

      const log = existing ?? await notificationLogRepository.createIfAbsent({
        organizationId: job.data.organizationId,
        recipient: job.data.to,
        template: job.data.kind,
        idempotencyKey: job.data.idempotencyKey,
      });
      if (!log) {
        const duplicate = await notificationLogRepository.findByKey(
          job.data.organizationId,
          job.data.idempotencyKey,
        );
        if (duplicate?.status === "sent") return;
        throw new Error("Unable to create notification log");
      }

      await notificationLogRepository.markAttempt(log.id);
      try {
        if (job.data.kind === "verification") {
          await emailProvider.sendVerificationEmail({
            to: job.data.to,
            verificationUrl: job.data.verificationUrl,
            expiresAt: new Date(job.data.expiresAt),
          });
        } else if (job.data.kind === "ticket") {
          await emailProvider.sendTicketNotification(job.data);
        } else if (job.data.kind === "sla-breach") {
          await emailProvider.sendSlaBreachAlert({
            to: job.data.to,
            ticketId: job.data.ticketId,
            subject: job.data.subject,
            breachedAt: new Date(job.data.breachedAt),
          });
        } else {
          await emailProvider.sendInvitationEmail({
            to: job.data.to,
            invitationUrl: job.data.invitationUrl,
            expiresAt: new Date(job.data.expiresAt),
          });
        }
        await notificationLogRepository.markSent(log.id);
      } catch (error) {
        await notificationLogRepository.markFailed(log.id, errorMessage(error));
        throw error;
      }
    },
    { connection, concurrency: 10 },
  );

  worker.on("failed", (job, error) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const dlq = getDeadLetterQueues();
      if (dlq) {
        void dlq.email.add(job.name, job.data, {
          jobId: `dlq:${job.id ?? job.name}`,
        });
      }
    }
    void Promise.resolve(error);
  });
  return worker;
};
