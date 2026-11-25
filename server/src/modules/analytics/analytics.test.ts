import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateRatePercent,
  calculateSlaCompliance,
  rangeToDays,
} from "./analytics.repository.js";
import {
  analyticsCacheKey,
  createAnalyticsService,
  type AnalyticsCacheClient,
} from "./analytics.service.js";
import type { AnalyticsOverview } from "./analytics.types.js";
import { analyticsOverviewQuerySchema } from "./analytics.validators.js";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";

const makeOverviewFixture = (
  range: "7d" | "30d" | "90d",
  totalTickets = 12,
): AnalyticsOverview => ({
  range,
  generatedAt: "2026-11-25T10:00:00.000Z",
  kpis: {
    totalTickets,
    openCount: 5,
    inProgressCount: 3,
    resolvedCount: 2,
    closedCount: 2,
    unassignedCount: 1,
    slaBreachedCount: 2,
    slaOnTrackCount: 10,
    slaCompliancePercent: 83.3,
    avgFirstResponseMinutes: 14.5,
    avgResolutionMinutes: 92,
  },
  volumeSeries: [{ date: "2026-11-25", created: 3, resolved: 1 }],
  byPriority: { urgent: 2, high: 4, medium: 4, low: 2 },
  byStatus: { open: 5, in_progress: 3, resolved: 2, closed: 2 },
  workload: [],
  aiPerformance: {
    agentDraftRequests: 4,
    customerQaRequests: 10,
    totalRequests: 14,
    avgConfidenceScore: 0.84,
    customerHandoffRate: 20,
    aiDeflectionRate: 80,
    totalPromptTokens: 1200,
    totalCompletionTokens: 450,
    topHelpfulArticles: [],
  },
});

describe("analytics validators", () => {
  it("defaults range to 30d and accepts 7d, 30d, 90d", () => {
    assert.deepEqual(analyticsOverviewQuerySchema.parse({}), { range: "30d" });
    assert.deepEqual(analyticsOverviewQuerySchema.parse({ range: "7d" }), { range: "7d" });
    assert.deepEqual(analyticsOverviewQuerySchema.parse({ range: "90d" }), { range: "90d" });
  });

  it("rejects unsupported ranges and extra query params", () => {
    assert.equal(analyticsOverviewQuerySchema.safeParse({ range: "365d" }).success, false);
    assert.equal(
      analyticsOverviewQuerySchema.safeParse({ range: "7d", organizationId: orgA }).success,
      false,
    );
  });
});

describe("analytics calculations", () => {
  it("computes SLA compliance percentage and AI rates", () => {
    assert.equal(rangeToDays("7d"), 7);
    assert.equal(rangeToDays("30d"), 30);
    assert.equal(rangeToDays("90d"), 90);
    assert.equal(calculateSlaCompliance(0, 0), 100);
    assert.equal(calculateSlaCompliance(10, 2), 80);
    assert.equal(calculateRatePercent(3, 12), 25);
    assert.equal(calculateRatePercent(0, 0), 0);
  });
});

describe("analytics service caching and tenant isolation", () => {
  it("uses tenant-scoped cache keys and hits Redis on subsequent reads", async () => {
    const store = new Map<string, string>();
    const cache: AnalyticsCacheClient = {
      async get(key) {
        return store.get(key) ?? null;
      },
      async set(key, value) {
        store.set(key, value);
        return "OK";
      },
      async del(...keys) {
        for (const key of keys) store.delete(key);
        return keys.length;
      },
    };

    let dbCalls = 0;
    const service = createAnalyticsService(
      {
        async getOverview(organizationId, range) {
          dbCalls += 1;
          return makeOverviewFixture(range, organizationId === orgA ? 10 : 25);
        },
      },
      () => cache,
    );

    const firstA = await service.getOverview(orgA, "7d");
    const secondA = await service.getOverview(orgA, "7d");
    const firstB = await service.getOverview(orgB, "7d");

    assert.equal(firstA.kpis.totalTickets, 10);
    assert.equal(secondA.kpis.totalTickets, 10);
    assert.equal(firstB.kpis.totalTickets, 25);
    assert.equal(dbCalls, 2);
    assert.ok(store.has(analyticsCacheKey(orgA, "7d")));
    assert.ok(store.has(analyticsCacheKey(orgB, "7d")));

    await service.invalidateTenantAnalytics(orgA);
    assert.equal(store.has(analyticsCacheKey(orgA, "7d")), false);
    assert.equal(store.has(analyticsCacheKey(orgB, "7d")), true);
  });

  it("falls back cleanly to DB when Redis is unavailable or throws", async () => {
    const failingCache: AnalyticsCacheClient = {
      async get() {
        throw new Error("ECONNREFUSED");
      },
      async set() {
        throw new Error("ECONNREFUSED");
      },
      async del() {
        throw new Error("ECONNREFUSED");
      },
    };

    let dbCalls = 0;
    const service = createAnalyticsService(
      {
        async getOverview(_orgId, range) {
          dbCalls += 1;
          return makeOverviewFixture(range, 7);
        },
      },
      () => failingCache,
    );

    const result = await service.getOverview(orgA, "30d");
    assert.equal(result.kpis.totalTickets, 7);
    assert.equal(dbCalls, 1);
    await service.invalidateTenantAnalytics(orgA);
  });
});
