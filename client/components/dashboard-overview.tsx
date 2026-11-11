"use client";

import {
  AlertCircle,
  ArrowRight,
  Building2,
  Plus,
  RefreshCw,
  Ticket as TicketIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiJson } from "@/lib/api";
import { summarizeTickets } from "@/lib/dashboard-data";
import type {
  PageResult,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-types";

const pageSize = 100;

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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function DashboardOverview() {
  const [result, setResult] = useState<PageResult<Ticket> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadDashboard() {
      try {
        const response = await apiJson<{ data: PageResult<Ticket> }>(
          `/tickets?page=1&limit=${pageSize}`,
          { signal },
        );
        if (!signal.aborted) {
          setResult(response.data);
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
  }, [reloadKey]);

  function retry() {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  }

  const tickets = result?.items ?? [];
  const summary = result ? summarizeTickets(result) : null;
  const maximumPriorityCount = summary
    ? Math.max(...Object.values(summary.byPriority))
    : 0;

  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">WORKSPACE OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            Your support operation, at a glance.
          </p>
        </div>
        <div className="dashboard-actions">
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
          <span>Loading ticket overview…</span>
        </section>
      ) : error ? (
        <section className="dashboard-message dashboard-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div>
            <strong>Dashboard unavailable</strong>
            <p>{error}</p>
            <button className="quiet-button" type="button" onClick={retry}>
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </section>
      ) : result && result.total === 0 ? (
        <section className="dashboard-empty">
          <span className="empty-icon" aria-hidden="true">
            <TicketIcon size={20} />
          </span>
          <h2>Your workspace is ready for its first ticket</h2>
          <p>Create a ticket to start tracking customer conversations here.</p>
          <Link className="primary-button" href="/tickets/new">
            <Plus size={16} />
            Create your first ticket
          </Link>
        </section>
      ) : result && result.items.length === 0 ? (
        <section className="dashboard-message dashboard-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div>
            <strong>Ticket data unavailable</strong>
            <p>
              The server reported tickets but did not return any records for
              the latest page.
            </p>
            <button className="quiet-button" type="button" onClick={retry}>
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </section>
      ) : result && summary ? (
        <>
          <section className="dashboard-total-card" aria-label="Total tickets">
            <div className="dashboard-total-icon" aria-hidden="true">
              <TicketIcon size={19} />
            </div>
            <div>
              <p>All tickets</p>
              <strong>{summary.total.toLocaleString()}</strong>
              <span>Across your workspace</span>
            </div>
            <Link href="/tickets" aria-label="View all tickets">
              <ArrowRight size={18} />
            </Link>
          </section>

          <section className="dashboard-section" aria-labelledby="status-summary-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="status-summary-title">Ticket status</h2>
                <p>Counts from the latest {summary.sampleSize} tickets</p>
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
                  <strong>{summary.byStatus[status]}</strong>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel dashboard-recent-panel" aria-labelledby="recent-tickets-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="recent-tickets-title">Recent tickets</h2>
                  <p>Latest activity in your inbox</p>
                </div>
                <Link className="text-button" href="/tickets">
                  All tickets <ArrowRight size={14} />
                </Link>
              </div>
              <ul className="dashboard-ticket-list">
                {tickets.slice(0, 5).map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      className="dashboard-ticket-link"
                      href={`/tickets/${ticket.id}`}
                    >
                      <span className="dashboard-ticket-icon" aria-hidden="true">
                        <TicketIcon size={15} />
                      </span>
                      <span className="dashboard-ticket-copy">
                        <strong>{ticket.subject}</strong>
                        <span>
                          <span className={`status-pill status-${ticket.status}`}>
                            {statusLabels[ticket.status]}
                          </span>
                          <span
                            className={`priority-label priority-${ticket.priority}`}
                          >
                            {priorityLabels[ticket.priority]} priority
                          </span>
                        </span>
                      </span>
                      <time
                        className="dashboard-ticket-date"
                        dateTime={ticket.createdAt}
                      >
                        {formatDate(ticket.createdAt)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dashboard-panel dashboard-priority-panel" aria-labelledby="priority-breakdown-title">
              <div className="dashboard-panel-heading">
                <div>
                  <h2 id="priority-breakdown-title">Priority breakdown</h2>
                  <p>Latest {summary.sampleSize} tickets</p>
                </div>
              </div>
              <ul className="dashboard-priority-list">
                {priorityOrder.map((priority) => {
                  const count = summary.byPriority[priority];
                  const percentage =
                    summary.sampleSize > 0
                      ? (count / summary.sampleSize) * 100
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
                        aria-label={`${priorityLabels[priority]}: ${count} tickets, ${Math.round(percentage)} percent of the displayed records`}
                      >
                        <span
                          className={`dashboard-priority-fill priority-fill-${priority}`}
                          style={{
                            width: `${maximumPriorityCount ? (count / maximumPriorityCount) * 100 : 0}%`,
                          }}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="dashboard-priority-note">
                This snapshot includes the newest page of ticket records, not
                an all-time priority aggregate.
              </p>
            </section>
          </div>
        </>
      ) : (
        <section className="dashboard-message dashboard-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <div>
            <strong>Ticket data unavailable</strong>
            <p>The server returned no ticket records for this workspace.</p>
            <button className="quiet-button" type="button" onClick={retry}>
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
