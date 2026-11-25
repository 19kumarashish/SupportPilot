import type { ticketPriorities, ticketStatuses } from "../../db/schema/tickets.js";

export type TicketPriority = (typeof ticketPriorities)[number];
export type TicketStatus = (typeof ticketStatuses)[number];

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
