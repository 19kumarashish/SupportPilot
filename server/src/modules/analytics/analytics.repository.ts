import { and, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";

import { aiUsageLogs } from "../../db/schema/ai-usage-logs.js";
import { kbArticles } from "../../db/schema/kb-articles.js";
import { teams } from "../../db/schema/teams.js";
import { tickets } from "../../db/schema/tickets.js";
import { db } from "../../infrastructure/database/index.js";
import { users } from "../../infrastructure/database/schema/users.js";
import type {
  AiPerformanceSummary,
  AnalyticsOverview,
  AnalyticsRange,
  DailyVolumePoint,
  KpiSummary,
  TicketPriority,
  TicketStatus,
  WorkloadEntry,
} from "./analytics.types.js";

export const rangeToDays = (range: AnalyticsRange): number => {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
};

export const calculateSlaCompliance = (
  totalTickets: number,
  breachedCount: number,
): number => {
  if (totalTickets <= 0) return 100;
  const onTrack = Math.max(0, totalTickets - breachedCount);
  return Math.round((onTrack / totalTickets) * 1000) / 10;
};

export const calculateRatePercent = (part: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
};

const startDateForRange = (range: AnalyticsRange): Date => {
  const days = rangeToDays(range);
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date;
};

const fillDailySeries = (
  range: AnalyticsRange,
  rows: Array<{ day: string; created: number; resolved: number }>,
): DailyVolumePoint[] => {
  const days = rangeToDays(range);
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const series: DailyVolumePoint[] = [];
  const cursor = startDateForRange(range);

  for (let i = 0; i < days; i++) {
    const isoDay = cursor.toISOString().slice(0, 10);
    const hit = byDay.get(isoDay);
    series.push({
      date: isoDay,
      created: hit?.created ?? 0,
      resolved: hit?.resolved ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
};

export const analyticsRepository = {
  async getOverview(
    organizationId: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsOverview> {
    const since = startDateForRange(range);
    const activeTicketFilter = and(
      eq(tickets.organizationId, organizationId),
      isNull(tickets.deletedAt),
    );
    const windowedTicketFilter = and(
      activeTicketFilter,
      gte(tickets.createdAt, since),
    );

    const [
      kpiRows,
      statusRows,
      priorityRows,
      volumeRows,
      teamRows,
      agentRows,
      aiSummaryRows,
      topArticleRows,
    ] = await Promise.all([
      db
        .select({
          totalTickets: sql<number>`count(*)::int`,
          unassignedCount: sql<number>`count(*) filter (where ${tickets.assignedTo} is null and ${tickets.assignedTeamId} is null)::int`,
          slaBreachedCount: sql<number>`count(*) filter (where ${tickets.slaBreachedAt} is not null)::int`,
          avgFirstResponseMinutes: sql<number | null>`avg(extract(epoch from (${tickets.firstRespondedAt} - ${tickets.createdAt})) / 60.0) filter (where ${tickets.firstRespondedAt} is not null)`,
          avgResolutionMinutes: sql<number | null>`avg(extract(epoch from (${tickets.updatedAt} - ${tickets.createdAt})) / 60.0) filter (where ${tickets.status} in ('resolved', 'closed'))`,
        })
        .from(tickets)
        .where(activeTicketFilter),

      db
        .select({
          status: tickets.status,
          count: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(activeTicketFilter)
        .groupBy(tickets.status),

      db
        .select({
          priority: tickets.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(activeTicketFilter)
        .groupBy(tickets.priority),

      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${tickets.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
          created: sql<number>`count(*)::int`,
          resolved: sql<number>`count(*) filter (where ${tickets.status} in ('resolved', 'closed'))::int`,
        })
        .from(tickets)
        .where(windowedTicketFilter)
        .groupBy(sql`1`)
        .orderBy(sql`1 asc`),

      db
        .select({
          id: teams.id,
          name: teams.name,
          openCount: sql<number>`count(${tickets.id}) filter (where ${tickets.status} in ('open', 'in_progress') and ${tickets.deletedAt} is null)::int`,
          resolvedCount: sql<number>`count(${tickets.id}) filter (where ${tickets.status} in ('resolved', 'closed') and ${tickets.deletedAt} is null)::int`,
          slaBreachedCount: sql<number>`count(${tickets.id}) filter (where ${tickets.slaBreachedAt} is not null and ${tickets.deletedAt} is null)::int`,
        })
        .from(teams)
        .leftJoin(
          tickets,
          and(
            eq(tickets.assignedTeamId, teams.id),
            eq(tickets.organizationId, organizationId),
          ),
        )
        .where(eq(teams.organizationId, organizationId))
        .groupBy(teams.id, teams.name)
        .orderBy(desc(sql`count(${tickets.id})`))
        .limit(10),

      db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          openCount: sql<number>`count(${tickets.id}) filter (where ${tickets.status} in ('open', 'in_progress') and ${tickets.deletedAt} is null)::int`,
          resolvedCount: sql<number>`count(${tickets.id}) filter (where ${tickets.status} in ('resolved', 'closed') and ${tickets.deletedAt} is null)::int`,
          slaBreachedCount: sql<number>`count(${tickets.id}) filter (where ${tickets.slaBreachedAt} is not null and ${tickets.deletedAt} is null)::int`,
        })
        .from(users)
        .leftJoin(
          tickets,
          and(
            eq(tickets.assignedTo, users.id),
            eq(tickets.organizationId, organizationId),
          ),
        )
        .where(and(eq(users.organizationId, organizationId), eq(users.isActive, true)))
        .groupBy(users.id, users.firstName, users.lastName)
        .orderBy(desc(sql`count(${tickets.id})`))
        .limit(10),

      db
        .select({
          agentDraftRequests: sql<number>`count(*) filter (where ${aiUsageLogs.feature} = 'agent_draft')::int`,
          customerQaRequests: sql<number>`count(*) filter (where ${aiUsageLogs.feature} = 'customer_qa')::int`,
          customerHandedOff: sql<number>`count(*) filter (where ${aiUsageLogs.feature} = 'customer_qa' and ${aiUsageLogs.handedOff} = true)::int`,
          avgConfidenceScore: sql<number | null>`avg(${aiUsageLogs.confidenceScore}::float8) filter (where ${aiUsageLogs.confidenceScore} is not null)`,
          totalPromptTokens: sql<number>`coalesce(sum(${aiUsageLogs.promptTokens}), 0)::int`,
          totalCompletionTokens: sql<number>`coalesce(sum(${aiUsageLogs.completionTokens}), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(
          and(
            eq(aiUsageLogs.organizationId, organizationId),
            gte(aiUsageLogs.createdAt, since),
          ),
        ),

      db
        .select({
          id: kbArticles.id,
          title: kbArticles.title,
          slug: kbArticles.slug,
          helpfulCount: kbArticles.helpfulCount,
          notHelpfulCount: kbArticles.notHelpfulCount,
        })
        .from(kbArticles)
        .where(
          and(
            eq(kbArticles.organizationId, organizationId),
            eq(kbArticles.status, "published"),
            isNotNull(kbArticles.publishedAt),
          ),
        )
        .orderBy(desc(kbArticles.helpfulCount), desc(kbArticles.updatedAt))
        .limit(5),
    ]);

    const byStatus: Record<TicketStatus, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    for (const row of statusRows) {
      byStatus[row.status] = Number(row.count);
    }

    const byPriority: Record<TicketPriority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const row of priorityRows) {
      byPriority[row.priority] = Number(row.count);
    }

    const rawKpi = kpiRows[0];
    const totalTickets = Number(rawKpi?.totalTickets ?? 0);
    const slaBreachedCount = Number(rawKpi?.slaBreachedCount ?? 0);
    const slaOnTrackCount = Math.max(0, totalTickets - slaBreachedCount);

    const kpis: KpiSummary = {
      totalTickets,
      openCount: byStatus.open,
      inProgressCount: byStatus.in_progress,
      resolvedCount: byStatus.resolved,
      closedCount: byStatus.closed,
      unassignedCount: Number(rawKpi?.unassignedCount ?? 0),
      slaBreachedCount,
      slaOnTrackCount,
      slaCompliancePercent: calculateSlaCompliance(totalTickets, slaBreachedCount),
      avgFirstResponseMinutes:
        rawKpi?.avgFirstResponseMinutes !== null &&
        rawKpi?.avgFirstResponseMinutes !== undefined
          ? Math.round(Number(rawKpi.avgFirstResponseMinutes) * 10) / 10
          : null,
      avgResolutionMinutes:
        rawKpi?.avgResolutionMinutes !== null &&
        rawKpi?.avgResolutionMinutes !== undefined
          ? Math.round(Number(rawKpi.avgResolutionMinutes) * 10) / 10
          : null,
    };

    const workload: WorkloadEntry[] = [
      ...teamRows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: "team" as const,
        openCount: Number(row.openCount),
        resolvedCount: Number(row.resolvedCount),
        slaBreachedCount: Number(row.slaBreachedCount),
      })),
      ...agentRows.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.trim(),
        kind: "agent" as const,
        openCount: Number(row.openCount),
        resolvedCount: Number(row.resolvedCount),
        slaBreachedCount: Number(row.slaBreachedCount),
      })),
    ];

    const rawAi = aiSummaryRows[0];
    const agentDraftRequests = Number(rawAi?.agentDraftRequests ?? 0);
    const customerQaRequests = Number(rawAi?.customerQaRequests ?? 0);
    const customerHandedOff = Number(rawAi?.customerHandedOff ?? 0);
    const customerHandoffRate = calculateRatePercent(
      customerHandedOff,
      customerQaRequests,
    );
    const aiDeflectionRate =
      customerQaRequests > 0
        ? Math.round((100 - customerHandoffRate) * 10) / 10
        : 0;

    const aiPerformance: AiPerformanceSummary = {
      agentDraftRequests,
      customerQaRequests,
      totalRequests: agentDraftRequests + customerQaRequests,
      avgConfidenceScore:
        rawAi?.avgConfidenceScore !== null &&
        rawAi?.avgConfidenceScore !== undefined
          ? Math.round(Number(rawAi.avgConfidenceScore) * 1000) / 1000
          : null,
      customerHandoffRate,
      aiDeflectionRate,
      totalPromptTokens: Number(rawAi?.totalPromptTokens ?? 0),
      totalCompletionTokens: Number(rawAi?.totalCompletionTokens ?? 0),
      topHelpfulArticles: topArticleRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        helpfulCount: Number(row.helpfulCount),
        notHelpfulCount: Number(row.notHelpfulCount),
      })),
    };

    return {
      range,
      generatedAt: new Date().toISOString(),
      kpis,
      volumeSeries: fillDailySeries(
        range,
        volumeRows.map((row) => ({
          day: row.day,
          created: Number(row.created),
          resolved: Number(row.resolved),
        })),
      ),
      byPriority,
      byStatus,
      workload,
      aiPerformance,
    };
  },
};
