import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { recordAuditEvent } from "../shared/security/audit.js";
import { ticketRepository } from "../modules/tickets/repositories/ticket.repository.js";
import { enqueueEmailJob } from "./jobs.js";
import { SLA_QUEUE_NAME, getDeadLetterQueues } from "./queues.js";

interface SlaMonitorJob {
  requestedAt: string;
}

export const createSlaMonitorWorker = (): Worker<SlaMonitorJob> | null => {
  if (!env.REDIS_URL) return null;
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const worker = new Worker<SlaMonitorJob>(
    SLA_QUEUE_NAME,
    async (_job: Job<SlaMonitorJob>) => {
      const tickets = await ticketRepository.findTicketsDueForBreach();
      for (const ticket of tickets) {
        const breached = await ticketRepository.markSlaBreached(
          ticket.organizationId,
          ticket.id,
        );
        if (!breached) continue;

        await recordAuditEvent({
          organizationId: ticket.organizationId,
          eventType: "ticket_sla_breached",
          resourceType: "ticket",
          resourceId: ticket.id,
          metadata: { resolutionDeadlineAt: ticket.resolutionDeadlineAt },
        });

        if (ticket.customerEmail) {
          await enqueueEmailJob({
            kind: "sla-breach",
            organizationId: ticket.organizationId,
            to: ticket.customerEmail,
            ticketId: ticket.id,
            subject: ticket.subject,
            breachedAt: new Date().toISOString(),
            idempotencyKey: `sla-breach:${ticket.organizationId}:${ticket.id}`,
          });
        }
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const dlq = getDeadLetterQueues();
      if (dlq) {
        void dlq.sla.add(job.name, job.data, {
          jobId: `dlq:${job.id ?? job.name}`,
        });
      }
    }
  });
  return worker;
};
