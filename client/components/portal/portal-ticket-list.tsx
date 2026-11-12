"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { customerApiJson, useCustomerAuth } from "@/lib/customer-auth";
import type { Ticket, TicketStatus } from "@/lib/ticket-types";

export function PortalTicketList() {
  const router = useRouter();
  const { ready, customerId, signOut } = useCustomerAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<"" | TicketStatus>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !customerId) router.replace("/portal/login");
    if (!customerId) return;
    customerApiJson<{ data: { items: Ticket[] } }>(`/customer/tickets?${status ? `status=${status}` : ""}`)
      .then((result) => setTickets(result.data.items))
      .catch(() => setError("Could not load your tickets."));
  }, [customerId, ready, router, status]);

  if (!ready || !customerId) return <main className="portal-page"><p>Opening your portal…</p></main>;
  return (
    <main className="portal-page">
      <div className="page-heading">
        <div><p className="eyebrow">CUSTOMER PORTAL</p><h1>Your tickets</h1></div>
        <div><Link className="primary-button" href="/portal/tickets/new">New ticket</Link><button className="quiet-button" type="button" onClick={signOut}>Sign out</button></div>
      </div>
      <label className="filter-select-wrap"><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value as "" | TicketStatus)}><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <section className="management-panel">
        {tickets.map((ticket) => <Link className="portal-ticket-row" href={`/portal/tickets/${ticket.id}`} key={ticket.id}><strong>{ticket.subject}</strong><span>{ticket.status} · {ticket.priority}</span>{ticket.slaDeadline && <small>SLA due {new Date(ticket.slaDeadline).toLocaleString()}</small>}</Link>)}
        {tickets.length === 0 && <p>No tickets found.</p>}
      </section>
    </main>
  );
}
