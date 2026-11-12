import { Worker } from "bullmq";

import { env } from "../config/env.js";
import { logger } from "../infrastructure/logger/index.js";
import { closeQueues, getSlaQueue } from "./queues.js";
import { createEmailNotificationWorker } from "./email-notification.worker.js";
import { createSlaMonitorWorker } from "./sla-monitor.worker.js";
import {
  createAttachmentCleanupWorker,
  scheduleAttachmentCleanup,
} from "./attachment-cleanup.worker.js";

const emailWorker = createEmailNotificationWorker();
const slaWorker = createSlaMonitorWorker();
const attachmentCleanupWorker = createAttachmentCleanupWorker();
const workers = [emailWorker, slaWorker, attachmentCleanupWorker].filter(
  (worker): worker is Worker => worker !== null,
);

if (env.REDIS_URL) {
  const queue = getSlaQueue();
  if (queue) {
    void queue.upsertJobScheduler(
      "sla-monitor-scheduler",
      { every: 60_000 },
      { name: "scan", data: { requestedAt: new Date().toISOString() } },
    );
  }
  void scheduleAttachmentCleanup();
}

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Worker shutdown requested");
  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ workerCount: workers.length }, "SupportPilot workers started");
