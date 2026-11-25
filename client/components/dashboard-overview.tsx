"use client";

import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  Clock3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ticket as TicketIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  fetchAnalyticsOverview,
  type AnalyticsOverview,
  type AnalyticsRange,
} from "@/lib/dashboard-data";
import type { TicketPriority, TicketStatus } from "@/lib/ticket-types";

const rangeOptions: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const statusLabels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const priorityLabels: Record<TicketPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const priorityOrder: TicketPriority[] = ["urgent", "high", "medium", "low"];

function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function DashboardOverview() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadDashboard() {
      setLoading(true);
      try {
        const response = await fetchAnalyticsOverview(range, signal);
        if (!signal.aborted) {
          setOverview(response.data);
          setError("");
        }
      } catch (cause) {
        if (signal.aborted) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not load your dashboard. Check your connection and try again.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void loadDashboard();
    return () => controller.abort();
  }, [range, reloadKey]);

  function refresh() {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  }

  const maxPriorityCount = overview
    ? Math.max(0, ...Object.values(overview.byPriority))
    : 0;
  const maxVolumeCount = overview
    ? Math.max(1, ...overview.volumeSeries.flatMap((point) => [point.created, point.resolved]))
    : 1;
  const visibleSeries = overview
    ? overview.volumeSeries.slice(-14)
    : [];

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">OPERATIONS & ANALYTICS</p>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Tenant-scoped ticket SLA health, team workload, and AI deflection.
          </p>
        </div>
        <div className="dashboard-actions">
          <div role="group" aria-label="Analytics time range" style={{ display: "inline-flex", gap: "0.25rem" }}>
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={range === option.value ? "primary-button" : "quiet-button"}
                aria-pressed={range === option.value}
                onClick={() => {
                  if (range !== option.value) {
                    setLoading(true);
                    setError("");
                    setRange(option.value);
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="quiet-button"
            onClick={refresh}
            aria-label="Refresh analytics"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <Link className="quiet-button" href="/tickets">
            <TicketIcon size={15} />
            View tickets
          </Link>
          <Link className="quiet-button" href="/customers">
            <Building2 size={15} />
            View customers
          </Link>
          <Link className="primary-button" href="/tickets/new">
            <Plus size={16} />
            Create ticket
          </Link>
        </div>
      </div>

      {loading ? (
        <section className="dashboard-loading" role="status" aria-live="polite">
          <span className="loading-mark" aria-hidden="true" />
          <span>Loading operations analytics…</span>
        </section>
      ) : error ? (
        <section className="dashboard-message dashboard-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div>
            <strong>Dashboard unavailable</strong>
            <p>{error}</p>
            <button className="quiet-button" type="button" onClick={refresh}>
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </section>
      ) : overview && overview.kpis.totalTickets === 0 ? (
        <section className="dashboard-empty">
          <span className="empty-icon" aria-hidden="true">
            <TicketIcon size={20} />
          </span>
          <h2>Your workspace is ready for its first ticket</h2>
          <p>Create a ticket to start tracking SLA compliance, team workload, and AI deflection here.</p>
          <Link className="primary-button" href="/tickets/new">
            <Plus size={16} />
            Create your first ticket
          </Link>
        </section>
      ) : overview ? (
        <>
          <section className="dashboard-status-grid" aria-label="Key performance indicators">
            <article className="dashboard-stat-card">
              <div className="dashboard-stat-label">
                <TicketIcon size={15} aria-hidden="true" />
                Open tickets
              </div>
              <strong>{overview.kpis.openCount + overview.kpis.inProgressCount}</strong>
              <small>{overview.kpis.unassignedCount} unassigned · {overview.kpis.totalTickets} total</small>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-label">
                <ShieldCheck size={15} aria-hidden="true" />
                SLA compliance
              </div>
              <strong>{overview.kpis.slaCompliancePercent}%</strong>
              <small>{overview.kpis.slaOnTrackCount} on track · {overview.kpis.slaBreachedCount} breached</small>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-label">
                <Clock3 size={15} aria-hidden="true" />
                Avg first response
              </div>
              <strong>{formatDurationMinutes(overview.kpis.avgFirstResponseMinutes)}</strong>
              <small>Resolution avg: {formatDurationMinutes(overview.kpis.avgResolutionMinutes)}</small>
            </article>

            <article className="dashboard-stat-card">
              <div className="dashboard-stat-label">
                <Bot size={15} aria-hidden="true" />
                AI deflection rate
              </div>
              <strong>{overview.aiPerformance.aiDeflectionRate}%</strong>
              <small>
                {(overview.aiPerformance.totalPromptTokens + overview.aiPerformance.totalCompletionTokens).toLocaleString()} tokens used
              </small>
            </article>
          </section>

          <section className="dashboard-section" aria-labelledby="status-summary-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="status-summary-title">Ticket status</h2>
                <p>Workspace totals across all active tickets</p>
              </div>
              <Link className="text-button" href="/tickets">
                View inbox <ArrowRight size={14} />
              </Link>
            </div>
            <div className="dashboard-status-grid">
              {(Object.keys(statusLabels) as TicketStatus[]).map((status) => (
                <article className="dashboard-stat-card" key={status}>
                  <div className="dashboard-stat-label">
                    <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
                    {statusLabels[status]}
                  </div>
                  <strong>{overview.byStatus[status]}</strong>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel" aria-labelledby="volume-trend-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="volume-trend-title">Ticket volume trend</h2>
                  <p>Daily created vs. resolved ({overview.range})</p>
                </div>
              </div>
              <div
                className="volume-chart"
                role="img"
                aria-label={`Daily created vs resolved ticket trend over ${overview.range}`}
                style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: "160px", paddingTop: "1rem" }}
              >
                {visibleSeries.map((point) => (
                  <div
                    key={point.date}
                    title={`${point.date}: ${point.created} created, ${point.resolved} resolved`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", height: "100%", justifyContent: "flex-end" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", width: "100%", height: "120px", justifyContent: "center" }}>
                      <span
                        style={{
                          width: "40%",
                          height: `${Math.max(4, Math.round((point.created / maxVolumeCount) * 100))}%`,
                          background: "var(--accent, #2563eb)",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                      <span
                        style={{
                          width: "40%",
                          height: `${Math.max(4, Math.round((point.resolved / maxVolumeCount) * 100))}%`,
                          background: "var(--success, #16a34a)",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                    </div>
                    <small style={{ fontSize: "0.68rem", opacity: 0.75 }}>{point.date.slice(5)}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard-panel dashboard-priority-panel" aria-labelledby="priority-breakdown-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="priority-breakdown-title">Priority &amp; SLA health</h2>
                  <p>{overview.kpis.slaOnTrackCount} on track · {overview.kpis.slaBreachedCount} breached</p>
                </div>
              </div>
              <ul className="dashboard-priority-list">
                {priorityOrder.map((priority) => {
                  const count = overview.byPriority[priority];
                  const percentage =
                    overview.kpis.totalTickets > 0
                      ? (count / overview.kpis.totalTickets) * 100
                      : 0;

                  return (
                    <li key={priority}>
                      <div className="dashboard-priority-meta">
                        <span className={`priority-label priority-${priority}`}>
                          <span className="priority-mark" aria-hidden="true" />
                          {priorityLabels[priority]}
                        </span>
                        <strong>{count}</strong>
                      </div>
                      <div
                        className="dashboard-priority-track"
                        role="img"
                        aria-label={`${priorityLabels[priority]}: ${count} tickets, ${Math.round(percentage)} percent`}
                      >
                        <span
                          className={`dashboard-priority-fill priority-fill-${priority}`}
                          style={{
                            width: `${maxPriorityCount ? (count / maxPriorityCount) * 100 : 0}%`,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel" aria-labelledby="workload-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="workload-title">Team &amp; agent workload</h2>
                  <p>Open, resolved, and SLA breaches</p>
                </div>
              </div>
              {overview.workload.length === 0 ? (
                <p className="empty-state">No teams or active agents found.</p>
              ) : (
                <table className="management-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th align="left">Assignee</th>
                      <th align="left">Type</th>
                      <th align="right">Open</th>
                      <th align="right">Resolved</th>
                      <th align="right">Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.workload.map((entry) => (
                      <tr key={`${entry.kind}-${entry.id}`}>
                        <td>{entry.name}</td>
                        <td>{entry.kind}</td>
                        <td align="right">{entry.openCount}</td>
                        <td align="right">{entry.resolvedCount}</td>
                        <td align="right">{entry.slaBreachedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="dashboard-panel" aria-labelledby="ai-kb-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="ai-kb-title">AI &amp; KB performance</h2>
                  <p>
                    {overview.aiPerformance.agentDraftRequests} agent drafts · {overview.aiPerformance.customerQaRequests} customer Q&amp;A
                  </p>
                </div>
                <Link className="text-button" href="/kb">
                  Manage KB <ArrowRight size={14} />
                </Link>
              </div>
              <dl className="detail-facts" style={{ marginBottom: "0.75rem" }}>
                <div>
                  <dt>Customer handoff rate</dt>
                  <dd>{overview.aiPerformance.customerHandoffRate}%</dd>
                </div>
                <div>
                  <dt>Avg AI confidence</dt>
                  <dd>
                    {overview.aiPerformance.avgConfidenceScore !== null
                      ? `${Math.round(overview.aiPerformance.avgConfidenceScore * 100)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <h3>Top helpful KB articles</h3>
              {overview.aiPerformance.topHelpfulArticles.length === 0 ? (
                <p className="empty-state">No published KB articles yet.</p>
              ) : (
                <ul className="dashboard-ticket-list">
                  {overview.aiPerformance.topHelpfulArticles.map((article) => (
                    <li key={article.id}>
                      <Link className="dashboard-ticket-link" href={`/kb/${article.id}`}>
                        <span className="dashboard-ticket-copy">
                          <strong>{article.title}</strong>
                          <span>{article.helpfulCount} helpful · {article.notHelpfulCount} not helpful</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
