import { Redis } from "ioredis";

import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logger/index.js";
import { analyticsRepository } from "./analytics.repository.js";
import type { AnalyticsOverview, AnalyticsRange } from "./analytics.types.js";
import { analyticsRanges } from "./analytics.validators.js";

const CACHE_TTL_SECONDS = 60;

export interface AnalyticsCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: "EX", time: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
}

let redisClient: Redis | null | undefined;

const getRedisClient = (): AnalyticsCacheClient | null => {
  if (!env.REDIS_URL) return null;
  if (redisClient === undefined) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redisClient.on("error", (error) => {
      logger.warn({ error }, "Analytics Redis client error");
    });
  }
  return redisClient;
};

export const analyticsCacheKey = (
  organizationId: string,
  range: AnalyticsRange,
): string => `analytics:${organizationId}:${range}`;

export const createAnalyticsService = (
  repository: Pick<typeof analyticsRepository, "getOverview"> = analyticsRepository,
  getCache: () => AnalyticsCacheClient | null = getRedisClient,
) => ({
  async getOverview(
    organizationId: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsOverview> {
    const key = analyticsCacheKey(organizationId, range);
    const cache = getCache();

    if (cache) {
      try {
        const cached = await cache.get(key);
        if (cached) {
          return JSON.parse(cached) as AnalyticsOverview;
        }
      } catch (error) {
        logger.warn({ error, organizationId, range }, "Analytics cache read failed; falling back to DB");
      }
    }

    const overview = await repository.getOverview(organizationId, range);

    if (cache) {
      try {
        await cache.set(key, JSON.stringify(overview), "EX", CACHE_TTL_SECONDS);
      } catch (error) {
        logger.warn({ error, organizationId, range }, "Analytics cache write failed");
      }
    }

    return overview;
  },

  async invalidateTenantAnalytics(organizationId: string): Promise<void> {
    const cache = getCache();
    if (!cache) return;
    try {
      const keys = analyticsRanges.map((range) => analyticsCacheKey(organizationId, range));
      await cache.del(...keys);
    } catch (error) {
      logger.warn({ error, organizationId }, "Analytics cache invalidation failed");
    }
  },
});

export const analyticsService = createAnalyticsService();

export const invalidateTenantAnalytics = (organizationId: string): Promise<void> =>
  analyticsService.invalidateTenantAnalytics(organizationId);
