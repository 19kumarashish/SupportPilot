import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { aiService } from "../modules/ai/ai.service.js";
import { KB_INDEXING_QUEUE_NAME } from "./queues.js";

export interface KbIndexingJob {
  organizationId: string;
  articleId: string;
}

export const createKbIndexingWorker = (): Worker<KbIndexingJob> | null => {
  if (!env.REDIS_URL) return null;
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return new Worker<KbIndexingJob>(
    KB_INDEXING_QUEUE_NAME,
    async (job: Job<KbIndexingJob>) => {
      await aiService.reindexArticle(job.data.organizationId, job.data.articleId);
    },
    { connection },
  );
};
