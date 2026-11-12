import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { attachmentStorage } from "../infrastructure/storage/index.js";
import { ticketAttachmentRepository } from "../modules/tickets/attachments/attachment.repository.js";
import {
  ATTACHMENT_CLEANUP_QUEUE_NAME,
  getAttachmentCleanupQueue,
} from "./queues.js";

export interface AttachmentCleanupJob {
  requestedAt: string;
}

export const findOrphanedKeys = (
  storageKeys: readonly string[],
  databaseKeys: ReadonlySet<string>,
): string[] => storageKeys.filter((key) => !databaseKeys.has(key));

export const cleanupAttachments = async (): Promise<void> => {
  const [storageKeys, databaseRows] = await Promise.all([
    attachmentStorage.listKeysByPrefix("org/"),
    ticketAttachmentRepository.listStorageKeys(),
  ]);
  const databaseKeys = new Set(databaseRows.map((row) => row.storageKey));
  await Promise.all(
    findOrphanedKeys(storageKeys, databaseKeys).map((key) =>
      attachmentStorage.delete(key),
    ),
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stalePending = await ticketAttachmentRepository.listStalePending(cutoff);
  for (const attachment of stalePending) {
    await attachmentStorage.delete(attachment.storageKey);
    await ticketAttachmentRepository.deleteById(attachment.id);
  }
};

export const createAttachmentCleanupWorker = (): Worker<AttachmentCleanupJob> | null => {
  if (!env.REDIS_URL) return null;
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return new Worker<AttachmentCleanupJob>(
    ATTACHMENT_CLEANUP_QUEUE_NAME,
    async (_job: Job<AttachmentCleanupJob>) => cleanupAttachments(),
    { connection, concurrency: 1 },
  );
};

export const scheduleAttachmentCleanup = async (): Promise<void> => {
  const queue = getAttachmentCleanupQueue();
  if (!queue) return;
  await queue.upsertJobScheduler(
    "attachment-cleanup-scheduler",
    { every: 60 * 60 * 1000 },
    { name: "cleanup", data: { requestedAt: new Date().toISOString() } },
  );
};
