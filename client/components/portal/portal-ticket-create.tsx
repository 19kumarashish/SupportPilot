"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { customerApiJson } from "@/lib/customer-auth";
import type { TicketPriority } from "@/lib/ticket-types";

export function PortalTicketCreate() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (file && (file.size > 10 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type))) {
      setError("Choose a PDF, PNG, or JPEG file up to 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await customerApiJson<{ data: { ticket: { id: string } } }>("/customer/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
      if (file) {
        const body = new FormData();
        body.append("file", file);
        await customerApiJson(`/customer/tickets/${result.data.ticket.id}/attachments`, { method: "POST", body });
      }
      router.replace(`/portal/tickets/${result.data.ticket.id}`);
    } catch {
      setError("Could not create your ticket.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="portal-page"><section className="management-panel portal-card"><Link href="/portal">Back to tickets</Link><h1>New ticket</h1><form className="management-form" onSubmit={submit}>{error && <p className="field-error" role="alert">{error}</p>}<label className="field-label" htmlFor="portal-subject">Subject</label><input id="portal-subject" className="text-field" value={subject} onChange={(event) => setSubject(event.target.value)} required /><label className="field-label" htmlFor="portal-description">Description</label><textarea id="portal-description" className="text-field" value={description} onChange={(event) => setDescription(event.target.value)} rows={6} required /><label className="field-label" htmlFor="portal-priority">Priority</label><select id="portal-priority" value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select><input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" /><button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create ticket"}</button></form></section></main>;
}
