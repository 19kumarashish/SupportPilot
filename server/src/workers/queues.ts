import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";

export const EMAIL_QUEUE_NAME = "email-notifications";
export const SLA_QUEUE_NAME = "sla-monitor";
export const EMAIL_DLQ_NAME = "email-notifications-dlq";
export const SLA_DLQ_NAME = "sla-monitor-dlq";

let connection: Redis | undefined;
let emailQueue: Queue | undefined;
let slaQueue: Queue | undefined;
let emailDlq: Queue | undefined;
let slaDlq: Queue | undefined;

const getConnection = (): Redis | null => {
  if (!env.REDIS_URL) return null;
  connection ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
};

const queueOptions = (redis: Redis) => ({
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential" as const, delay: 1_000 },
    removeOnComplete: 1_000,
    removeOnFail: 10_000,
  },
});

export const getEmailQueue = (): Queue | null => {
  const redis = getConnection();
  if (!redis) return null;
  emailQueue ??= new Queue(EMAIL_QUEUE_NAME, queueOptions(redis));
  return emailQueue;
};

export const getSlaQueue = (): Queue | null => {
  const redis = getConnection();
  if (!redis) return null;
  slaQueue ??= new Queue(SLA_QUEUE_NAME, queueOptions(redis));
  return slaQueue;
};

export const getDeadLetterQueues = (): {
  email: Queue;
  sla: Queue;
} | null => {
  const redis = getConnection();
  if (!redis) return null;
  const options = queueOptions(redis);
  emailDlq ??= new Queue(EMAIL_DLQ_NAME, options);
  slaDlq ??= new Queue(SLA_DLQ_NAME, options);
  return { email: emailDlq, sla: slaDlq };
};

export const closeQueues = async (): Promise<void> => {
  await Promise.all([
    emailQueue?.close(),
    slaQueue?.close(),
    emailDlq?.close(),
    slaDlq?.close(),
  ]);
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
  emailQueue = undefined;
  slaQueue = undefined;
  emailDlq = undefined;
  slaDlq = undefined;
};
