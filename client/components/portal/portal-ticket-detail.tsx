"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { customerApiBlob, customerApiJson, useCustomerAuth } from "@/lib/customer-auth";
import type { Ticket, TicketAttachment, TicketComment } from "@/lib/ticket-types";

export function filterPublicCustomerComments(comments: TicketComment[]): TicketComment[] {
  return comments.filter((comment) => !comment.isInternal);
}

export function PortalTicketDetail({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { ready, customerId } = useCustomerAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && !customerId) router.replace("/portal/login");
    if (!customerId) return;
    Promise.all([
      customerApiJson<{ data: { ticket: Ticket } }>(`/customer/tickets/${ticketId}`),
      customerApiJson<{ data: { comments: TicketComment[] } }>(`/customer/tickets/${ticketId}/comments`),
      customerApiJson<{ data: { attachments: TicketAttachment[] } }>(`/customer/tickets/${ticketId}/attachments`),
    ]).then(([ticketResult, commentResult, attachmentResult]) => {
      setTicket(ticketResult.data.ticket);
      setComments(filterPublicCustomerComments(commentResult.data.comments));
      setAttachments(attachmentResult.data.attachments);
    }).catch(() => setError("Could not load this ticket."));
  }, [customerId, ready, router, ticketId]);

  async function sendReply() {
    if (!reply.trim()) return;
    await customerApiJson(`/customer/tickets/${ticketId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
    setComments((current) => [...current, { id: crypto.randomUUID(), ticketId, authorId: customerId ?? "", body: reply, isInternal: false, createdAt: new Date().toISOString() }]);
    setReply("");
  }

  async function upload() {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const result = await customerApiJson<{ data: { attachment: TicketAttachment } }>(`/customer/tickets/${ticketId}/attachments`, { method: "POST", body });
    setAttachments((current) => [...current, result.data.attachment]);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function download(attachment: TicketAttachment) {
    if (attachment.scanStatus !== "clean") return;
    const blob = await customerApiBlob(`/customer/tickets/${ticketId}/attachments/${attachment.id}/download`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = attachment.originalFilename; link.click(); URL.revokeObjectURL(url);
  }

  if (!ready || !customerId) return <main className="portal-page"><p>Opening your portal…</p></main>;
  return <main className="portal-page"><Link href="/portal">Back to tickets</Link>{error && <p className="field-error" role="alert">{error}</p>}{ticket && <><h1>{ticket.subject}</h1><p>{ticket.description}</p><section className="management-panel"><h2>Conversation</h2>{comments.map((comment) => <article key={comment.id}><p>{comment.body}</p><small>{new Date(comment.createdAt).toLocaleString()}</small></article>)}<textarea className="text-field" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to support" /><button className="primary-button" type="button" onClick={() => void sendReply()}>Send reply</button></section><section className="management-panel"><h2>Attachments</h2>{attachments.map((attachment) => <div key={attachment.id}><span>{attachment.originalFilename} · {attachment.scanStatus ?? "clean"}</span><button type="button" disabled={attachment.scanStatus !== "clean"} onClick={() => void download(attachment)}>Download</button></div>)}<input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><button className="quiet-button" type="button" onClick={() => void upload()}>Upload attachment</button></section></>}</main>;
}
