"use client";

import { AlertCircle, ArrowLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { ApiError, apiJson } from "@/lib/api";
import { loadAllCustomers } from "@/lib/ticket-data";
import { createTicketSchema } from "@/lib/ticket-workflow";
import type {
  Customer,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketTag,
} from "@/lib/ticket-types";

type TicketField = keyof z.infer<typeof createTicketSchema>;

const priorityOptions: TicketPriority[] = ["low", "medium", "high", "urgent"];
const statusOptions: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export function TicketCreate() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState("");
  const [retryCustomers, setRetryCustomers] = useState(0);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [tags, setTags] = useState<TicketTag[]>([]);
  const [values, setValues] = useState({
    customerId: "",
    subject: "",
    description: "",
    priority: "medium" as TicketPriority,
    status: "open" as TicketStatus,
    categoryId: null as string | null,
    tagIds: [] as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TicketField, string>>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      loadAllCustomers(controller.signal),
      apiJson<{ data: { categories: TicketCategory[] } }>("/tickets/categories", { signal: controller.signal }),
      apiJson<{ data: { tags: TicketTag[] } }>("/tickets/tags", { signal: controller.signal }),
    ])
      .then(([customersResult, categoriesResult, tagsResult]) => {
        if (!controller.signal.aborted) {
          setCustomers(customersResult.filter((customer) => customer.isActive));
          setCategories(categoriesResult.data.categories.filter((category) => category.isActive));
          setTags(tagsResult.data.tags);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setCustomersError(
            cause instanceof ApiError
              ? cause.message
              : "Could not load customers. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCustomersLoading(false);
      });

    return () => controller.abort();
  }, [retryCustomers]);

  function retryCustomerLoad() {
    setCustomersLoading(true);
    setCustomersError("");
    setRetryCustomers((count) => count + 1);
  }

  function updateField<K extends TicketField>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = createTicketSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<TicketField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as TicketField | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    if (submissionLock.current) return;
    submissionLock.current = true;
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await apiJson<{ data: { ticket: Ticket } }>("/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      router.push(`/tickets/${result.data.ticket.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not create this ticket. Check your connection and try again.",
      );
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <Link className="back-link" href="/tickets">
        <ArrowLeft size={15} aria-hidden="true" /> Back to inbox
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CUSTOMER SUPPORT</p>
          <h1>Create ticket</h1>
          <p className="page-subtitle">Start a new conversation for a customer in this workspace.</p>
        </div>
      </div>

      <section className="ticket-create-panel" aria-labelledby="create-ticket-heading">
        <h2 id="create-ticket-heading">Ticket details</h2>
        <p className="ticket-create-intro">Choose an active customer and describe the issue.</p>

        {customersError && (
          <div className="inline-alert" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{customersError}</span>
            <button
              className="text-button"
              type="button"
              onClick={retryCustomerLoad}
            >
              Retry
            </button>
          </div>
        )}
        {customers.length === 0 && !customersLoading && !customersError && (
          <div className="empty-state ticket-create-empty">
            <span className="empty-icon"><AlertCircle size={21} aria-hidden="true" /></span>
            <h3>No active customers</h3>
            <p>Create or reactivate a customer before opening a ticket.</p>
          </div>
        )}

        <form className="ticket-create-form" onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="ticket-customer">Customer</label>
          <select
            id="ticket-customer"
            className="text-field"
            value={values.customerId}
            onChange={(event) => updateField("customerId", event.target.value)}
            disabled={customersLoading || Boolean(customersError) || customers.length === 0 || submitting}
            aria-invalid={Boolean(fieldErrors.customerId)}
            aria-describedby={fieldErrors.customerId ? "ticket-customer-error" : undefined}
            required
          >
            <option value="">
              {customersLoading ? "Loading customers…" : "Select a customer"}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}{customer.company ? ` · ${customer.company}` : ""}
              </option>
            ))}
          </select>
          {fieldErrors.customerId && (
            <p className="field-error" id="ticket-customer-error">{fieldErrors.customerId}</p>
          )}

          <label className="field-label" htmlFor="ticket-subject">Subject</label>
          <input
            id="ticket-subject"
            className="text-field"
            value={values.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            maxLength={255}
            aria-invalid={Boolean(fieldErrors.subject)}
            aria-describedby={fieldErrors.subject ? "ticket-subject-error" : "ticket-subject-hint"}
            disabled={submitting}
            required
          />
          <p className={fieldErrors.subject ? "field-error" : "field-hint"} id={fieldErrors.subject ? "ticket-subject-error" : "ticket-subject-hint"}>
            {fieldErrors.subject ?? "Use a short summary of the customer’s issue."}
          </p>

          <label className="field-label" htmlFor="ticket-description">Description</label>
          <textarea
            id="ticket-description"
            className="ticket-create-description"
            value={values.description}
            onChange={(event) => updateField("description", event.target.value)}
            maxLength={10_000}
            rows={7}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? "ticket-description-error" : undefined}
            disabled={submitting}
            required
          />
          {fieldErrors.description && (
            <p className="field-error" id="ticket-description-error">{fieldErrors.description}</p>
          )}

          <div className="ticket-create-selects">
            <div>
              <label className="field-label" htmlFor="ticket-priority">Priority</label>
              <select
                id="ticket-priority"
                className="text-field"
                value={values.priority}
                onChange={(event) => updateField("priority", event.target.value)}
                disabled={submitting}
              >
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority[0]?.toUpperCase()}{priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="ticket-status">Initial status</label>
              <select
                id="ticket-status"
                className="text-field"
                value={values.status}
                onChange={(event) => updateField("status", event.target.value)}
                disabled={submitting}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ").replace(/^\w/u, (letter) => letter.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="field-label" htmlFor="ticket-category">Category</label>
          <select
            id="ticket-category"
            className="text-field"
            value={values.categoryId ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                categoryId: event.target.value || null,
              }))
            }
            disabled={submitting}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <label className="field-label" htmlFor="ticket-tags">Tags</label>
          <select
            id="ticket-tags"
            className="text-field"
            multiple
            size={Math.min(4, Math.max(2, tags.length))}
            value={values.tagIds}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                tagIds: Array.from(event.target.selectedOptions, (option) => option.value),
              }))
            }
            disabled={submitting || tags.length === 0}
          >
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>

          {error && <div className="inline-alert" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          <div className="ticket-create-actions">
            <Link className="quiet-button" href="/tickets">Cancel</Link>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || customersLoading || customersError !== "" || customers.length === 0}
            >
              {submitting
                ? <><LoaderCircle className="spin" size={15} /> Creating…</>
                : <>Create ticket <ArrowUpRight size={15} aria-hidden="true" /></>}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
