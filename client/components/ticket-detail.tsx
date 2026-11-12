"use client";

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Link2,
  MessageCircle,
  Paperclip,
  Send,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { ApiError, apiBlob, apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadAllActiveAgents } from "@/lib/ticket-data";
import type {
  Customer,
  TeamMember,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketActivity,
  TicketRelation,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-types";

const commentPageSize = 50;
const attachmentPageSize = 50;
const maxAttachmentBytes = 10 * 1024 * 1024;
const allowedAttachmentTypes = ["application/pdf", "image/png", "image/jpeg"];

interface CommentPage {
  comments: TicketComment[];
  page: number;
  total: number;
  totalPages: number;
}

interface AttachmentPage {
  attachments: TicketAttachment[];
  page: number;
  total: number;
  totalPages: number;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTransitions(status: TicketStatus): TicketStatus[] {
  const allowed: Record<TicketStatus, TicketStatus[]> = {
    open: ["open", "in_progress", "resolved", "closed"],
    in_progress: ["in_progress", "resolved", "closed"],
    resolved: ["resolved", "closed"],
    closed: ["closed", "open", "in_progress"],
  };
  return allowed[status];
}

function requestError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function getAttachmentIcon(type: string) {
  return type.startsWith("image/") ? <ImageIcon size={17} /> : <FileText size={17} />;
}

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [activity, setActivity] = useState<TicketActivity[]>([]);
  const [relations, setRelations] = useState<TicketRelation[]>([]);
  const [relationTicketId, setRelationTicketId] = useState("");
  const [relationType, setRelationType] = useState<TicketRelation["relationType"]>("related");
  const [attachmentPage, setAttachmentPage] = useState(1);
  const [attachmentTotal, setAttachmentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relatedError, setRelatedError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadWorkspace() {
      setLoading(true);
      setError("");
      setRelatedError("");
      setCustomer(null);
      setMembers([]);
      try {
        const [ticketResult, commentResult, attachmentResult, activityResult, relationResult] = await Promise.all([
          apiJson<{ data: { ticket: Ticket } }>(`/tickets/${ticketId}`, { signal }),
          apiJson<{ data: CommentPage }>(
            `/tickets/${ticketId}/comments?page=1&limit=${commentPageSize}`,
            { signal },
          ),
          apiJson<{ data: AttachmentPage }>(
            `/tickets/${ticketId}/attachments?page=1&limit=${attachmentPageSize}`,
            { signal },
          ),
          apiJson<{ data: { activity: TicketActivity[] } }>(`/tickets/${ticketId}/activity`, { signal }),
          apiJson<{ data: { relations: TicketRelation[] } }>(`/tickets/${ticketId}/relations`, { signal }),
        ]);
        if (signal.aborted) return;
        setTicket(ticketResult.data.ticket);
        setComments(commentResult.data.comments);
        setCommentPage(commentResult.data.page);
        setCommentTotal(commentResult.data.total);
        setAttachments(attachmentResult.data.attachments);
        setAttachmentPage(attachmentResult.data.page);
        setAttachmentTotal(attachmentResult.data.total);
        setActivity(activityResult.data.activity);
        setRelations(relationResult.data.relations);

        const relatedRequests: Promise<void>[] = [
          apiJson<{ data: { customer: Customer } }>(
            `/customers/${ticketResult.data.ticket.customerId}`,
            { signal },
          ).then(({ data }) => {
            if (!signal.aborted) setCustomer(data.customer);
          }).catch((cause: unknown) => {
            if (!signal.aborted) {
              setRelatedError((current) =>
                [current, `Customer details: ${requestError(cause, "unavailable")}`]
                  .filter(Boolean).join(" "),
              );
            }
          }),
        ];
        if (user?.role === "admin") {
          setMembersLoading(true);
          relatedRequests.push(
            loadAllActiveAgents(signal)
              .then((activeAgents) => {
                if (!signal.aborted) setMembers(activeAgents);
              })
              .catch((cause: unknown) => {
                if (!signal.aborted) {
                  setRelatedError((current) =>
                    [current, `Team members: ${requestError(cause, "unavailable")}`]
                      .filter(Boolean).join(" "),
                  );
                }
              })
              .finally(() => {
                if (!signal.aborted) setMembersLoading(false);
              }),
          );
        } else {
          setMembers([]);
          setMembersLoading(false);
        }
        await Promise.all(relatedRequests);
      } catch (cause) {
        if (!signal.aborted) {
          setError(requestError(cause, "Could not load this ticket."));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void loadWorkspace();
    return () => controller.abort();
  }, [ticketId, reloadKey, user?.role]);

  async function runAction(
    name: string,
    action: () => Promise<void>,
    successMessage?: string,
  ) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyAction(name);
    setActionError("");
    setActionMessage("");
    try {
      await action();
      if (successMessage) setActionMessage(successMessage);
    } catch (cause) {
      setActionError(requestError(cause, "That action could not be completed."));
    } finally {
      actionLock.current = false;
      setBusyAction("");
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) {
      setActionError("Write a message before sending.");
      return;
    }
    await runAction("comment", async () => {
      await apiJson(`/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, isInternal }),
      });
      setCommentBody("");
      setReloadKey((key) => key + 1);
    }, isInternal ? "Internal note added." : "Reply sent.");
  }

  async function loadMoreComments() {
    const nextPage = commentPage + 1;
    await runAction("comments", async () => {
      const response = await apiJson<{ data: CommentPage }>(
        `/tickets/${ticketId}/comments?page=${nextPage}&limit=${commentPageSize}`,
      );
      setComments((current) => [...current, ...response.data.comments]);
      setCommentPage(response.data.page);
    });
  }

  async function loadMoreAttachments() {
    const nextPage = attachmentPage + 1;
    await runAction("attachments", async () => {
      const response = await apiJson<{ data: AttachmentPage }>(
        `/tickets/${ticketId}/attachments?page=${nextPage}&limit=${attachmentPageSize}`,
      );
      setAttachments((current) => [...current, ...response.data.attachments]);
      setAttachmentPage(response.data.page);
    });
  }

  async function uploadAttachment() {
    if (!selectedFile) {
      setActionError("Choose a file to upload.");
      return;
    }
    if (selectedFile.size > maxAttachmentBytes) {
      setActionError("Attachments must be no larger than 10 MB.");
      return;
    }
    if (!allowedAttachmentTypes.includes(selectedFile.type)) {
      setActionError("Choose a PDF, PNG, or JPEG file.");
      return;
    }
    await runAction("upload", async () => {
      const body = new FormData();
      body.append("file", selectedFile);
      await apiJson(`/tickets/${ticketId}/attachments`, {
        method: "POST",
        body,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setReloadKey((key) => key + 1);
    }, "Attachment uploaded.");
  }

  async function downloadAttachment(attachment: TicketAttachment) {
    await runAction(`download-${attachment.id}`, async () => {
      const file = await apiBlob(
        `/tickets/${ticketId}/attachments/${attachment.id}/download`,
      );
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalFilename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    });
  }

  async function deleteAttachment(attachment: TicketAttachment) {
    if (!window.confirm(`Delete "${attachment.originalFilename}"? This cannot be undone.`)) {
      return;
    }
    await runAction(`delete-${attachment.id}`, async () => {
      await apiJson(`/tickets/${ticketId}/attachments/${attachment.id}`, {
        method: "DELETE",
      });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setAttachmentTotal((total) => Math.max(0, total - 1));
    }, "Attachment deleted.");
  }

  async function updateStatus(nextStatus: TicketStatus) {
    if (!ticket) return;
    await runAction("status", async () => {
      const response = await apiJson<{ data: { ticket: Ticket } }>(
        `/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      setTicket(response.data.ticket);
    }, "Status updated.");
  }

  async function updatePriority(nextPriority: TicketPriority) {
    if (!ticket) return;
    await runAction("priority", async () => {
      const response = await apiJson<{ data: { ticket: Ticket } }>(
        `/tickets/${ticketId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: nextPriority }),
        },
      );
      setTicket(response.data.ticket);
    }, "Priority updated.");
  }

  async function updateAssignee(assignedTo: string) {
    await runAction("assignee", async () => {
      const response = await apiJson<{ data: { ticket: Ticket } }>(
        `/tickets/${ticketId}/assignment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo: assignedTo || null }),
        },
      );
      setTicket(response.data.ticket);
    }, "Assignment updated.");
  }

  async function updateArchive(archived: boolean) {
    await runAction("archive", async () => {
      const response = await apiJson<{ data: { ticket: Ticket } }>(`/tickets/${ticketId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      setTicket(response.data.ticket);
    }, archived ? "Ticket archived." : "Ticket restored.");
  }

  async function addRelation() {
    if (!relationTicketId.trim()) return;
    await runAction("relation", async () => {
      const response = await apiJson<{ data: { relation: TicketRelation } }>(`/tickets/${ticketId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedTicketId: relationTicketId.trim(), relationType }),
      });
      setRelations((current) => [...current, response.data.relation]);
      setRelationTicketId("");
    }, "Relation added.");
  }

  async function removeRelation(relationId: string) {
    await runAction("relation", async () => {
      await apiJson(`/tickets/${ticketId}/relations/${relationId}`, { method: "DELETE" });
      setRelations((current) => current.filter((relation) => relation.id !== relationId));
    }, "Relation removed.");
  }

  if (loading) {
    return (
      <AppShell>
        <div className="detail-loading" aria-live="polite">
          <LoaderCircle className="spin" size={20} />
          <span>Loading conversation…</span>
        </div>
      </AppShell>
    );
  }

  if (error || !ticket) {
    return (
      <AppShell>
        <Link className="back-link" href="/tickets"><ArrowLeft size={15} /> Back to inbox</Link>
        <div className="detail-error" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Couldn’t open this ticket</strong>
            <p>{error || "Ticket not found."}</p>
            {error && (
              <button
                type="button"
                className="text-button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const assignedMember = members.find((member) => member.id === ticket.assignedTo);
  const resolved = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <AppShell>
      <Link className="back-link" href="/tickets"><ArrowLeft size={15} /> Back to inbox</Link>
      <div className="detail-heading">
        <div className="detail-title-block">
          <p className="eyebrow">TICKET <span>#{ticket.id.slice(0, 8)}</span></p>
          <h1>{ticket.subject}</h1>
        </div>
        <div className="detail-state-controls">
          <label className="select-control">
            <span className="sr-only">Ticket status</span>
            <select
              aria-label="Ticket status"
              value={ticket.status}
              disabled={Boolean(busyAction)}
              onChange={(event) => void updateStatus(event.target.value as TicketStatus)}
            >
              {statusTransitions(ticket.status).map((status) => (
                <option value={status} key={status}>{humanize(status)}</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <label className="select-control">
            <span className="sr-only">Ticket priority</span>
            <select
              aria-label="Ticket priority"
              value={ticket.priority}
              disabled={Boolean(busyAction)}
              onChange={(event) => void updatePriority(event.target.value as TicketPriority)}
            >
              {(["urgent", "high", "medium", "low"] as TicketPriority[]).map((priority) => (
                <option value={priority} key={priority}>{humanize(priority)} priority</option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
        </div>
      </div>

      {(actionError || relatedError) && (
        <div className="inline-alert" role="alert">
          <AlertCircle size={16} />
          <span>{actionError || relatedError}</span>
          {actionError && (
            <button type="button" className="alert-dismiss" onClick={() => setActionError("")} aria-label="Dismiss error">×</button>
          )}
        </div>
      )}
      {actionMessage && (
        <div className="inline-success" role="status">
          <Check size={16} />
          <span>{actionMessage}</span>
        </div>
      )}

      <div className="detail-layout">
        <section className="conversation-column" aria-label="Ticket conversation">
          <section className="detail-card activity-card" aria-label="Ticket activity">
            <h2>Activity timeline</h2>
            <ol className="activity-timeline">
              {activity.map((item) => (
                <li key={item.id}><strong>{humanize(item.action)}</strong><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>
              ))}
              {activity.length === 0 && <li>No activity recorded yet.</li>}
            </ol>
          </section>
          <div className="conversation-context">
            <div className="customer-profile">
              <span className="customer-avatar customer-avatar-large">
                {(customer?.name ?? ticket.customerId).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{customer?.name ?? "Customer"}</strong>
                <span>{customer?.email ?? `Customer ID ${ticket.customerId.slice(0, 8)}`}</span>
              </div>
            </div>
            <div className="conversation-dates">
              <span>Created {formatDate(ticket.createdAt)}</span>
              <span>Updated {formatDate(ticket.updatedAt)}</span>
            </div>
          </div>
          <article className="ticket-description">
            <div className="message-author">
              <span className="customer-avatar"><UserRound size={15} /></span>
              <strong>Original ticket description</strong>
              <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time>
            </div>
            <p>{ticket.description}</p>
          </article>

          <div className="thread-divider">
            <span />
            <span><MessageCircle size={14} /> {commentTotal} {commentTotal === 1 ? "reply" : "replies"}</span>
            <span />
          </div>
          <div className="comment-thread" aria-live="polite">
            {comments.map((comment) => (
              <article className={`comment-card ${comment.isInternal ? "comment-internal" : ""}`} key={comment.id}>
                <div className="message-author">
                  <span className={`customer-avatar ${comment.isInternal ? "staff-avatar" : ""}`}>
                    {comment.isInternal ? <LockKeyhole size={14} /> : <UserRound size={15} />}
                  </span>
                  <strong>{comment.authorId === user?.id ? "You" : "Support team"}</strong>
                  {comment.isInternal && <span className="internal-badge"><LockKeyhole size={11} /> Internal note</span>}
                  <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                </div>
                <p>{comment.body}</p>
              </article>
            ))}
            {comments.length === 0 && (
              <div className="thread-empty">
                <MessageCircle size={18} />
                <span>No replies yet. Send a message to continue the conversation.</span>
              </div>
            )}
          </div>
          {commentPage * commentPageSize < commentTotal && (
            <button
              type="button"
              className="load-more-button"
              disabled={Boolean(busyAction)}
              onClick={() => void loadMoreComments()}
            >
              {busyAction === "comments" ? <LoaderCircle className="spin" size={14} /> : null}
              Load more replies
            </button>
          )}

          {!resolved ? (
            <form className="reply-composer" onSubmit={submitComment}>
              <label htmlFor="reply-body" className="composer-label">
                {isInternal ? <><LockKeyhole size={14} /> Internal note</> : <><MessageCircle size={14} /> Reply to customer</>}
              </label>
              <textarea
                id="reply-body"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder={isInternal ? "Write a note for your team…" : "Write a reply…"}
                maxLength={10_000}
                rows={4}
                disabled={Boolean(busyAction)}
              />
              <div className="composer-footer">
                <label className="internal-toggle">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(event) => setIsInternal(event.target.checked)}
                    disabled={Boolean(busyAction)}
                  />
                  <LockKeyhole size={13} />
                  Internal note
                </label>
                <button className="primary-button send-button" type="submit" disabled={Boolean(busyAction) || !commentBody.trim()}>
                  {busyAction === "comment" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
                  {isInternal ? "Add note" : "Send reply"}
                </button>
              </div>
            </form>
          ) : (
            <div className="resolved-banner"><Check size={16} /> This ticket is {ticket.status}. Reopen it to reply.</div>
          )}
        </section>

        <aside className="ticket-sidebar" aria-label="Ticket details">
          <section className="detail-card">
            <h2>Ticket details</h2>
            <dl className="detail-facts">
              <div>
                <dt>Status</dt>
                <dd><span className={`status-pill status-${ticket.status}`}><span className="status-dot" />{humanize(ticket.status)}</span></dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd><span className={`priority-label priority-${ticket.priority}`}><span className="priority-mark" />{ticket.priority}</span></dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>
                  {user?.role === "admin" ? (
                    <label className="assignee-select">
                      <span className="sr-only">Assign ticket to a team member</span>
                      <select
                        value={ticket.assignedTo ?? ""}
                        disabled={membersLoading || Boolean(busyAction)}
                        onChange={(event) => void updateAssignee(event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {ticket.assignedTo &&
                          !members.some((member) => member.id === ticket.assignedTo) && (
                            <option value={ticket.assignedTo} disabled>
                              Current assignee unavailable
                            </option>
                          )}
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="assignee-name">
                      <span className="assignee-avatar">{assignedMember ? `${assignedMember.firstName[0]}${assignedMember.lastName[0]}` : "—"}</span>
                      {assignedMember
                        ? `${assignedMember.firstName} ${assignedMember.lastName}`
                        : ticket.assignedTo ? "Assigned team member" : "Unassigned"}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Resolution SLA</dt>
                <dd className={`sla-label sla-${ticket.slaStatus ?? "on_track"}`}>
                  {ticket.slaStatus === "breached" ? <AlertCircle size={13} /> : ticket.slaStatus === "completed" ? <Check size={13} /> : <Clock3 size={13} />}
                  {humanize(ticket.slaStatus ?? "on_track")}
                </dd>
              </div>
              {ticket.slaDeadline && (
                <div>
                  <dt>Due by</dt>
                  <dd className="fact-value">{formatDate(ticket.slaDeadline)}</dd>
                </div>
              )}
              <div>
                <dt>Customer</dt>
                <dd className="customer-fact">
                  <strong>{customer?.name ?? "Customer"}</strong>
                  {customer?.company && <span>{customer.company}</span>}
                  {customer?.email && <span>{customer.email}</span>}
                </dd>
              </div>
            </dl>
            <div className="detail-card-section">
              <div className="card-title-row"><h2>Linked tickets</h2><Link2 size={16} /></div>
              <ul className="relation-list">
                {relations.map((relation) => (
                  <li key={relation.id}>
                    <span>{humanize(relation.relationType)} · {relation.relatedTicketId.slice(0, 8)}</span>
                    <button type="button" className="text-button" onClick={() => void removeRelation(relation.id)}>Unlink</button>
                  </li>
                ))}
              </ul>
              <div className="inline-form">
                <input className="text-field" value={relationTicketId} onChange={(event) => setRelationTicketId(event.target.value)} placeholder="Related ticket UUID" />
                <select value={relationType} onChange={(event) => setRelationType(event.target.value as TicketRelation["relationType"])}>
                  {(["parent", "child", "duplicate", "related"] as const).map((value) => <option value={value} key={value}>{humanize(value)}</option>)}
                </select>
                <button type="button" className="quiet-button" onClick={() => void addRelation()}>Link</button>
              </div>
            </div>
            <button type="button" className="quiet-button" onClick={() => void updateArchive(Boolean(!ticket.archivedAt))}>
              {ticket.archivedAt ? "Restore ticket" : "Archive ticket"}
            </button>
          </section>

          <section className="detail-card attachment-card">
            <div className="card-title-row">
              <h2>Attachments <span className="count-badge">{attachmentTotal}</span></h2>
              <Paperclip size={16} />
            </div>
            {attachments.length > 0 ? (
              <ul className="attachment-list">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="attachment-item">
                    <span className="attachment-file-icon">{getAttachmentIcon(attachment.contentType)}</span>
                    <span className="attachment-copy">
                      <strong title={attachment.originalFilename}>{attachment.originalFilename}</strong>
                      <small>{formatBytes(attachment.sizeBytes)} · {formatDate(attachment.createdAt)} · {attachment.scanStatus ?? "clean"}</small>
                    </span>
                    <button
                      type="button"
                      className="icon-button attachment-action"
                      aria-label={`Download ${attachment.originalFilename}`}
                      title="Download"
                      disabled={busyAction === `download-${attachment.id}` || attachment.scanStatus !== "clean"}
                      onClick={() => void downloadAttachment(attachment)}
                    >
                      {busyAction === `download-${attachment.id}` ? <LoaderCircle size={15} className="spin" /> : <ArrowDownToLine size={15} />}
                    </button>
                    {user?.role === "admin" && (
                      <button
                        type="button"
                        className="icon-button attachment-action delete-attachment"
                        aria-label={`Delete ${attachment.originalFilename}`}
                        title="Delete attachment"
                        disabled={Boolean(busyAction)}
                        onClick={() => void deleteAttachment(attachment)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-attachments">No files attached to this ticket.</p>
            )}
            {attachmentPage * attachmentPageSize < attachmentTotal && (
              <button
                type="button"
                className="load-more-button attachment-load-more"
                disabled={Boolean(busyAction)}
                onClick={() => void loadMoreAttachments()}
              >
                {busyAction === "attachments" ? <LoaderCircle className="spin" size={14} /> : null}
                Load more files
              </button>
            )}
            <div className="upload-control">
              <label className="file-picker">
                <Upload size={14} />
                <span>{selectedFile ? selectedFile.name : "Choose a file"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(event) => {
                    setActionError("");
                    setSelectedFile(event.target.files?.[0] ?? null);
                  }}
                  disabled={Boolean(busyAction)}
                />
              </label>
              <button
                type="button"
                className="upload-button"
                disabled={!selectedFile || Boolean(busyAction)}
                onClick={() => void uploadAttachment()}
              >
                {busyAction === "upload" ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
                Upload
              </button>
            </div>
            <p className="upload-help">PDF, PNG or JPEG · 10 MB max</p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
