import { apiJson } from "./api";
import type {
  PageResult,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "./ticket-types";

export interface TicketBreakdown {
  total: number;
  sampleSize: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
}

export function summarizeTickets(
  result: PageResult<Ticket>,
): TicketBreakdown {
  const byStatus: Record<TicketStatus, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
  const byPriority: Record<TicketPriority, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const ticket of result.items) {
    byStatus[ticket.status] += 1;
    byPriority[ticket.priority] += 1;
  }

  return {
    total: result.total,
    sampleSize: result.items.length,
    byStatus,
    byPriority,
  };
}

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface KpiSummary {
  totalTickets: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  unassignedCount: number;
  slaBreachedCount: number;
  slaOnTrackCount: number;
  slaCompliancePercent: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export interface DailyVolumePoint {
  date: string;
  created: number;
  resolved: number;
}

export interface WorkloadEntry {
  id: string;
  name: string;
  kind: "team" | "agent";
  openCount: number;
  resolvedCount: number;
  slaBreachedCount: number;
}

export interface TopHelpfulArticle {
  id: string;
  title: string;
  slug: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface AiPerformanceSummary {
  agentDraftRequests: number;
  customerQaRequests: number;
  totalRequests: number;
  avgConfidenceScore: number | null;
  customerHandoffRate: number;
  aiDeflectionRate: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  topHelpfulArticles: TopHelpfulArticle[];
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  generatedAt: string;
  kpis: KpiSummary;
  volumeSeries: DailyVolumePoint[];
  byPriority: Record<TicketPriority, number>;
  byStatus: Record<TicketStatus, number>;
  workload: WorkloadEntry[];
  aiPerformance: AiPerformanceSummary;
}

export const fetchAnalyticsOverview = (
  range: AnalyticsRange,
  signal?: AbortSignal,
) =>
  apiJson<{ success: true; data: AnalyticsOverview }>(
    `/analytics/overview?range=${range}`,
    signal ? { signal } : undefined,
  );
