"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  Check,
  CircleDot,
  Clock3,
  Filter,
  Inbox,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { TicketManagementPanel } from "@/components/ticket-management-panel";
import { ApiError, apiJson } from "@/lib/api";
import { loadAllCustomers } from "@/lib/ticket-data";
import {
  buildTicketListQuery,
} from "@/lib/ticket-workflow";
import type {
  Customer,
  PageResult,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-types";
import { buildBulkTicketPayload, type BulkTicketAction } from "@/lib/ticket-bulk-workflow";

const pageSize = 20;

const statusOptions: { value: "" | TicketStatus; label: string }[] = [
  { value: "", label: "All tickets" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityOptions: { value: "" | TicketPriority; label: string }[] = [
  { value: "", label: "Any priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatRelative(date: string): string {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, duration] of ranges) {
    if (Math.abs(seconds) >= duration) {
      return formatter.format(Math.round(seconds / duration), unit);
    }
  }
  return formatter.format(Math.round(seconds), "second");
}

function SlaIndicator({ ticket }: { ticket: Ticket }) {
  if (ticket.status === "resolved" || ticket.status === "closed") {
    return <span className="sla-label sla-complete"><Check size={13} /> Met</span>;
  }
  const status = ticket.slaStatus ?? "on_track";
  const icons = {
    on_track: <Clock3 size={13} />,
    at_risk: <AlertCircle size={13} />,
    breached: <AlertCircle size={13} />,
    completed: <Check size={13} />,
  };
  const labels = {
    on_track: "On track",
    at_risk: "At risk",
    breached: "Breached",
    completed: "Met",
  };
  return (
    <span className={`sla-label sla-${status}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

export function TicketInbox() {
  const [status, setStatus] = useState<"" | TicketStatus>("");
  const [priority, setPriority] = useState<"" | TicketPriority>("");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersError, setCustomersError] = useState("");
  const [customersRetry, setCustomersRetry] = useState(0);
  const customerQueryApplied = useRef(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<Ticket> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkTicketAction>("status");
  const [bulkValue, setBulkValue] = useState("in_progress");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadAllCustomers(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setCustomers(items.filter((customer) => customer.isActive));
          setCustomersError("");
          if (!customerQueryApplied.current) {
            const requestedCustomerId = new URLSearchParams(window.location.search).get("customerId");
            if (requestedCustomerId && items.some((customer) => customer.id === requestedCustomerId)) {
              setCustomerId(requestedCustomerId);
            }
            customerQueryApplied.current = true;
          }
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          customerQueryApplied.current = true;
          setCustomersError(
            cause instanceof ApiError
              ? cause.message
              : "Customer names and customer filtering are unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, [customersRetry]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const query = buildTicketListQuery({
      page,
      pageSize,
      status,
      priority,
      customerId,
      search,
    });

    async function loadTickets() {
      try {
        const response = await apiJson<{ data: PageResult<Ticket> }>(
          `/tickets?${query}`,
          { signal },
        );
        if (!signal.aborted) setResult(response.data);
      } catch (cause) {
        if (signal.aborted) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Could not connect to your ticket inbox. Check your connection and try again.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void loadTickets();
    return () => controller.abort();
  }, [customerId, page, priority, reloadKey, search, status]);

  function changeStatus(value: "" | TicketStatus) {
    setLoading(true);
    setError("");
    setStatus(value);
    setSearch("");
    setPage(1);
  }

  function changePriority(value: "" | TicketPriority) {
    setLoading(true);
    setError("");
    setPriority(value);
    setSearch("");
    setPage(1);
  }

  function changeCustomer(value: string) {
    setLoading(true);
    setError("");
    setCustomerId(value);
    setSearch("");
    setPage(1);
  }

  const tickets = result?.items ?? [];
  const visibleTickets = tickets;
  const allVisibleSelected = visibleTickets.length > 0 && visibleTickets.every((ticket) => selectedIds.includes(ticket.id));
  const hasFilters = Boolean(status || priority || customerId || search);

  function clearFilters() {
    setStatus("");
    setPriority("");
    setCustomerId("");
    setSearch("");
    setPage(1);
    setLoading(true);
    setError("");
  }

  async function applyBulkAction() {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    setError("");
    try {
      const teamId = bulkAction === "team" ? window.prompt("Team UUID (leave blank to unassign)") : undefined;
      const tagIds = bulkAction === "tags"
        ? (window.prompt("Tag UUIDs separated by commas", "") ?? "").split(",").map((value) => value.trim()).filter(Boolean)
        : undefined;
      const payload = buildBulkTicketPayload({
        ticketIds: selectedIds,
        action: bulkAction,
        ...(bulkAction === "team" ? { assignedTeamId: teamId || null } : {}),
        ...(bulkAction === "tags" ? { tagIds } : {}),
        ...(bulkAction === "status" ? { status: bulkValue as TicketStatus } : {}),
        ...(bulkAction === "priority" ? { priority: bulkValue as TicketPriority } : {}),
      });
      await apiJson("/tickets/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSelectedIds([]);
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Bulk action could not be completed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="page-heading inbox-heading">
        <div>
          <p className="eyebrow">YOUR TEAM’S QUEUE</p>
          <h1>Inbox</h1>
          <p className="page-subtitle">
            Keep every customer conversation moving.
          </p>
        </div>
        <div className="inbox-heading-meta">
          <span className="queue-count">
            <Inbox size={15} />
            {loading ? "Updating…" : `${result?.total ?? 0} tickets`}
          </span>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              setLoading(true);
              setError("");
              setReloadKey((key) => key + 1);
            }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <Link className="primary-button create-ticket-link" href="/tickets/new">
            <TicketIcon size={15} aria-hidden="true" />
            Create ticket
          </Link>
        </div>
      </div>

      <div className="inbox-toolbar">
        <div className="status-tabs" role="group" aria-label="Filter by status">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option.value || "all"}
              className={`status-tab ${status === option.value ? "status-tab-active" : ""}`}
              aria-pressed={status === option.value}
              onClick={() => changeStatus(option.value)}
            >
              {option.value === "open" ? <CircleDot size={14} /> : null}
              {option.label}
            </button>
          ))}
        </div>
        <div className="inbox-filter-controls">
          <label className="filter-select-wrap">
            <Filter size={14} aria-hidden="true" />
            <span className="sr-only">Filter by priority</span>
            <select
              value={priority}
              onChange={(event) => changePriority(event.target.value as "" | TicketPriority)}
            >
              {priorityOptions.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-select-wrap customer-filter">
            <span className="sr-only">Filter by customer</span>
            <select
              value={customerId}
              onChange={(event) => changeCustomer(event.target.value)}
              disabled={Boolean(customersError)}
            >
              <option value="">Any customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="ticket-search-row">
        <label className="ticket-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search tickets on this page</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search current page"
          />
          {search && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <span className="search-scope">Searches only the tickets on this page.</span>
        {hasFilters && (
          <button className="text-button reset-filters" type="button" onClick={clearFilters}>
            Clear all filters
          </button>
        )}
        <TicketManagementPanel />
      </div>
      {customersError && (
        <div className="filter-unavailable" role="status">
          Customer names and customer filtering could not be loaded.{" "}
          <button className="text-button" type="button" onClick={() => setCustomersRetry((count) => count + 1)}>
            Retry
          </button>
        </div>
      )}
      {hasFilters && (
        <div className="active-filters" aria-label="Active filters">
          {status && <span className="filter-chip">Status: {formatLabel(status)}</span>}
          {priority && <span className="filter-chip">Priority: {priority}</span>}
          {customerId && (
            <span className="filter-chip">
              Customer: {customers.find((customer) => customer.id === customerId)?.name ?? "Selected"}
            </span>
          )}
          {search && <span className="filter-chip">Search: {search}</span>}
        </div>
      )}

      <section className="ticket-list-panel" aria-label="Tickets">
        <div className="ticket-list-head">
          <span className="table-title">
            <TicketIcon size={16} />
            {status ? formatLabel(status) : "All tickets"}
          </span>
          {!loading && result && (
            <span className="result-range">
              {search
                ? `${visibleTickets.length} shown on this page`
                : result.total === 0
                ? "No tickets"
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, result.total)} of ${result.total}`}
            </span>
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="bulk-action-toolbar" role="toolbar" aria-label="Bulk ticket actions">
            <strong>{selectedIds.length} selected</strong>
            <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkTicketAction)}>
              <option value="status">Change status</option>
              <option value="priority">Change priority</option>
              <option value="team">Assign team</option>
              <option value="tags">Replace tags</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
            </select>
            {bulkAction === "status" && (
              <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}>
                {statusOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
            {bulkAction === "priority" && (
              <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}>
                {priorityOptions.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
            {(bulkAction === "team" || bulkAction === "tags") && (
              <span className="search-scope">
                IDs will be requested when you apply this action.
              </span>
            )}
            <button type="button" className="primary-button" disabled={bulkBusy} onClick={() => void applyBulkAction()}>
              {bulkBusy ? "Applying…" : "Apply"}
            </button>
            <button type="button" className="quiet-button" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        )}

        {error && (
          <div className="panel-message error-state" role="alert">
            <AlertCircle size={19} />
            <div>
              <strong>We couldn’t load this inbox.</strong>
              <p>{error}</p>
              <button className="text-button" onClick={() => {
                setLoading(true);
                setError("");
                setReloadKey((key) => key + 1);
              }}>
                Try again
              </button>
            </div>
          </div>
        )}

        {loading && !error && (
          <div className="ticket-skeleton-list" aria-label="Loading tickets" aria-live="polite">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="ticket-skeleton-row" key={index}>
                <span /><span /><span /><span />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon"><Inbox size={22} /></span>
            <h2>{status || priority || customerId ? "No matching tickets" : "Your inbox is clear"}</h2>
            <p>
              {status || priority || customerId
                ? "Try a different status, priority, or customer filter."
                : "New customer conversations will appear here."}
            </p>
            {(status || priority || customerId) && (
              <button
                className="quiet-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && !error && tickets.length > 0 && visibleTickets.length === 0 && search && (
          <div className="empty-state">
            <span className="empty-icon"><Search size={21} aria-hidden="true" /></span>
            <h2>No tickets found on this page</h2>
            <p>Search applies only to the current page of server results.</p>
            <button className="quiet-button" type="button" onClick={() => setSearch("")}>Clear search</button>
          </div>
        )}

        {!loading && !error && visibleTickets.length > 0 && (
          <>
            <div className="ticket-table-scroll">
              <table className="ticket-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        type="checkbox"
                        aria-label="Select all visible tickets"
                        checked={allVisibleSelected}
                        onChange={(event) => setSelectedIds(event.target.checked ? visibleTickets.map((ticket) => ticket.id) : [])}
                      />
                    </th>
                    <th scope="col">Conversation</th>
                    <th scope="col">Status</th>
                    <th scope="col">Priority</th>
                    <th scope="col">SLA</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Created</th>
                    <th scope="col"><span className="sr-only">Open ticket</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${ticket.subject}`}
                          checked={selectedIds.includes(ticket.id)}
                          onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, ticket.id])] : current.filter((id) => id !== ticket.id))}
                        />
                      </td>
                      <td className="ticket-subject-cell">
                        <Link href={`/tickets/${ticket.id}`} className="ticket-title-link">
                          {ticket.subject}
                        </Link>
                        <span className="ticket-id">#{ticket.id.slice(0, 8)}</span>
                      </td>
                      <td>
                        <span className={`status-pill status-${ticket.status}`}>
                          <span className="status-dot" />
                          {formatLabel(ticket.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`priority-label priority-${ticket.priority}`}>
                          <span className="priority-mark" />
                          {ticket.priority}
                        </span>
                      </td>
                      <td><SlaIndicator ticket={ticket} /></td>
                      <td>
                        <span className="customer-reference" title={ticket.customerId}>
                          <span className="customer-avatar">
                            {(customers.find((customer) => customer.id === ticket.customerId)?.name ?? ticket.customerId).slice(0, 1).toUpperCase()}
                          </span>
                          {customers.find((customer) => customer.id === ticket.customerId)?.name ?? `Customer ${ticket.customerId.slice(0, 8)}`}
                        </span>
                      </td>
                      <td>
                        <time className="ticket-time" dateTime={ticket.createdAt} title={new Date(ticket.createdAt).toLocaleString()}>
                          {formatRelative(ticket.createdAt)}
                        </time>
                      </td>
                      <td className="row-action-cell">
                        <Link href={`/tickets/${ticket.id}`} className="row-open" aria-label={`Open ${ticket.subject}`}>
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-ticket-list">
              {visibleTickets.map((ticket) => (
                <Link className="mobile-ticket" href={`/tickets/${ticket.id}`} key={ticket.id}>
                  <div className="mobile-ticket-top">
                    <span className={`status-pill status-${ticket.status}`}>
                      <span className="status-dot" />{formatLabel(ticket.status)}
                    </span>
                    <span className={`priority-label priority-${ticket.priority}`}>
                      <span className="priority-mark" />{ticket.priority}
                    </span>
                  </div>
                  <strong>{ticket.subject}</strong>
                  <span className="mobile-ticket-bottom">
                    <span>
                      #{ticket.id.slice(0, 8)} ·{" "}
                      {customers.find((customer) => customer.id === ticket.customerId)?.name ?? `Customer ${ticket.customerId.slice(0, 8)}`}
                    </span>
                    <time dateTime={ticket.createdAt}>{formatRelative(ticket.createdAt)}</time>
                  </span>
                  <SlaIndicator ticket={ticket} />
                </Link>
              ))}
            </div>
            <div className="pagination-row">
              <span className="pagination-copy">
                Page {result?.page ?? page} of {Math.max(result?.totalPages ?? 1, 1)}
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-button"
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    setPage((current) => Math.max(1, current - 1));
                  }}
                >
                  <ArrowLeft size={15} />
                  Previous
                </button>
                <button
                  className="pagination-button"
                  type="button"
                  disabled={!result || page >= result.totalPages || loading}
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    setPage((current) => current + 1);
                  }}
                >
                  Next
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="inbox-footnote">
        Showing live ticket data from your workspace.
        <span> Search isn’t available in the ticket API yet.</span>
      </p>
      <span className="sr-only" aria-live="polite">{loading ? "Updating ticket list" : ""}</span>
    </AppShell>
  );
}
