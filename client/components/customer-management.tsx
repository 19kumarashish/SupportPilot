"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { ApiError, apiJson } from "@/lib/api";
import {
  customerInputSchema,
  searchCurrentCustomers,
  type CustomerInput,
} from "@/lib/customer-workflow";
import type { Customer, PageResult } from "@/lib/ticket-types";

const pageSize = 20;
const blankCustomer: CustomerInput = {
  name: "",
  email: "",
  phone: "",
  company: "",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : fallback;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function CustomerDirectory() {
  const [result, setResult] = useState<PageResult<Customer> | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ data: PageResult<Customer> }>(
      `/customers?page=${page}&limit=${pageSize}&includeDeleted=true`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted) setResult(response.data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(cause, "Could not load customers. Check your connection and try again."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, reloadKey]);

  const pageItems = result?.items ?? [];
  const searched = searchCurrentCustomers(pageItems, query);
  const visible = searched.filter((customer) =>
    activeFilter === "all" ||
    (activeFilter === "active" ? customer.isActive : !customer.isActive),
  );

  function refreshCustomers() {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }

  async function restoreCustomer(customerId: string) {
    try {
      await apiJson(`/customers/${customerId}/restore`, { method: "PATCH" });
      refreshCustomers();
    } catch (cause) {
      setError(errorMessage(cause, "Could not restore this customer."));
    }
  }

  return (
    <AppShell>
      <div className="page-heading management-heading">
        <div>
          <p className="eyebrow">CUSTOMER DIRECTORY</p>
          <h1>Customers</h1>
          <p className="page-subtitle">Manage the people and organizations your team supports.</p>
        </div>
        <Link className="primary-button" href="/customers/new">
          <Plus size={16} aria-hidden="true" /> Add customer
        </Link>
      </div>

      <section className="management-panel" aria-label="Customer directory">
        <div className="management-toolbar">
          <label className="management-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search customers on this page</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this page"
            />
          </label>
          <label className="management-filter">
            <span className="sr-only">Filter customers by status</span>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button
            type="button"
            className="quiet-button"
            onClick={refreshCustomers}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
        <p className="management-scope">
          Search and status filters apply only to the customers on this page.
        </p>

        {error && (
          <div className="inline-alert" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
            <button className="text-button" type="button" onClick={refreshCustomers}>
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="management-loading" role="status">
            <LoaderCircle className="spin" size={18} /> Loading customers…
          </div>
        )}

        {!loading && !error && pageItems.length === 0 && (
          <div className="management-empty">
            <span className="empty-icon"><UserRound size={21} /></span>
            <h2>{result?.total === 0 ? "No customers yet" : "No customers on this page"}</h2>
            <p>Add a customer to start creating support tickets for them.</p>
            <Link className="quiet-button" href="/customers/new">
              <Plus size={14} /> Add customer
            </Link>
          </div>
        )}

        {!loading && !error && pageItems.length > 0 && visible.length === 0 && (
          <div className="management-empty">
            <span className="empty-icon"><Search size={20} /></span>
            <h2>No matching customers</h2>
            <p>Try changing the search text or status filter.</p>
            <button
              className="quiet-button"
              type="button"
              onClick={() => {
                setQuery("");
                setActiveFilter("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="management-table-scroll">
            <table className="management-table">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Company</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Status</th>
                  <th scope="col">Added</th>
                  <th scope="col"><span className="sr-only">View customer</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link className="management-primary-link" href={`/customers/${customer.id}`}>
                        <span className="management-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
                        {customer.name}
                      </Link>
                    </td>
                    <td>{customer.company || "—"}</td>
                    <td>{customer.email || customer.phone || "—"}</td>
                    <td>
                      <span className={`management-status ${customer.isActive ? "is-active" : "is-inactive"}`}>
                        {customer.deletedAt ? "Archived" : customer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDate(customer.createdAt)}</td>
                    <td>
                      {customer.deletedAt ? (
                        <button className="text-button" type="button" onClick={() => void restoreCustomer(customer.id)}>Restore</button>
                      ) : <Link className="text-button" href={`/customers/${customer.id}`}>View</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && result.totalPages > 1 && (
          <div className="management-pagination">
            <span>Page {result.page} of {result.totalPages} · {result.total} customers</span>
            <div>
              <button className="pagination-button" type="button" disabled={page <= 1 || loading} onClick={() => {
                setLoading(true);
                setError("");
                setPage((value) => Math.max(1, value - 1));
              }}>
                <ArrowLeft size={15} /> Previous
              </button>
              <button className="pagination-button" type="button" disabled={page >= result.totalPages || loading} onClick={() => {
                setLoading(true);
                setError("");
                setPage((value) => value + 1);
              }}>
                Next <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

export function CustomerRecordPage({ customerId }: { customerId: string }) {
  const isNew = customerId === "new";
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [values, setValues] = useState<CustomerInput>(blankCustomer);
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CustomerInput, string>>>({});
  const submitLock = useRef(false);

  useEffect(() => {
    if (isNew) return;
    const controller = new AbortController();
    apiJson<{ data: { customer: Customer } }>(`/customers/${customerId}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setCustomer(data.customer);
          setValues({
            name: data.customer.name,
            email: data.customer.email ?? "",
            phone: data.customer.phone ?? "",
            company: data.customer.company ?? "",
          });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause, "Could not load this customer."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [customerId, isNew, reloadKey]);

  function updateValue(field: keyof CustomerInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
    setSuccess("");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const parsed = customerInputSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof CustomerInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values && !nextErrors[field as keyof CustomerInput]) {
          nextErrors[field as keyof CustomerInput] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }
    if (submitLock.current) return;

    const payload = Object.fromEntries(
      Object.entries(parsed.data)
        .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
        .filter(([, value]) => value !== ""),
    );
    submitLock.current = true;
    setSaving(true);
    try {
      const response = await apiJson<{ data: { customer: Customer } }>(
        isNew ? "/customers" : `/customers/${customerId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setCustomer(response.data.customer);
      setValues({
        name: response.data.customer.name,
        email: response.data.customer.email ?? "",
        phone: response.data.customer.phone ?? "",
        company: response.data.customer.company ?? "",
      });
      setFieldErrors({});
      if (isNew) {
        router.replace(`/customers/${response.data.customer.id}`);
      } else {
        setEditing(false);
        setSuccess("Customer details saved.");
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "CUSTOMER_EMAIL_EXISTS"
          ? "A customer with this email already exists in this workspace."
          : errorMessage(cause, "Could not save this customer. Check your connection and try again."),
      );
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!customer || busyStatus) return;
    const nextActive = !customer.isActive;
    if (!nextActive && !window.confirm("Deactivate this customer? They will no longer be available when creating new tickets. Existing tickets will remain.")) {
      return;
    }
    setBusyStatus(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiJson<{ data: { customer: Customer } }>(
        `/customers/${customer.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextActive }),
        },
      );
      setCustomer(response.data.customer);
      setSuccess(nextActive ? "Customer reactivated." : "Customer deactivated. Existing tickets were not changed.");
    } catch (cause) {
      setError(errorMessage(cause, "Could not update customer status."));
    } finally {
      setBusyStatus(false);
    }
  }

  const pageTitle = isNew ? "Add customer" : customer?.name ?? "Customer";

  return (
    <AppShell>
      <Link className="back-link" href="/customers"><ArrowLeft size={15} /> Back to customers</Link>
      <div className="page-heading management-heading record-heading">
        <div>
          <p className="eyebrow">CUSTOMER PROFILE</p>
          <h1>{pageTitle}</h1>
          <p className="page-subtitle">
            {isNew ? "Add a customer to your workspace directory." : "Review and update customer contact details."}
          </p>
        </div>
        {customer && (
          <div className="management-heading-actions">
            <Link className="quiet-button" href={`/tickets?customerId=${encodeURIComponent(customer.id)}`}>
              View tickets
            </Link>
            {!editing && (
              <button type="button" className="primary-button" onClick={() => setEditing(true)}>
                Edit details
              </button>
            )}
          </div>
        )}
      </div>

      {loading && <div className="management-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading customer…</div>}
      {error && (
        <div className="inline-alert" role="alert">
          <AlertCircle size={16} /><span>{error}</span>
          {!isNew && !customer && <button className="text-button" type="button" onClick={() => {
            setLoading(true);
            setError("");
            setReloadKey((value) => value + 1);
          }}>Retry</button>}
        </div>
      )}
      {success && <div className="inline-success" role="status"><Check size={16} />{success}</div>}

      {!loading && (isNew || customer) && (
        <div className="management-record-layout">
          <section className="management-panel management-form-panel">
            <h2>{editing ? (isNew ? "Customer details" : "Edit customer") : "Contact details"}</h2>
            <p className="management-panel-intro">Only fields supported by this workspace are collected.</p>
            <form className="management-form" onSubmit={saveCustomer} noValidate>
              <label className="field-label" htmlFor="customer-name">Customer name</label>
              <input id="customer-name" className="text-field" value={values.name} onChange={(event) => updateValue("name", event.target.value)} disabled={!editing || saving} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "customer-name-error" : undefined} required />
              {fieldErrors.name && <p className="field-error" id="customer-name-error">{fieldErrors.name}</p>}

              <label className="field-label" htmlFor="customer-email">Email address</label>
              <input id="customer-email" className="text-field" type="email" autoComplete="email" value={values.email ?? ""} onChange={(event) => updateValue("email", event.target.value)} disabled={!editing || saving} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "customer-email-error" : undefined} />
              {fieldErrors.email && <p className="field-error" id="customer-email-error">{fieldErrors.email}</p>}

              <label className="field-label" htmlFor="customer-phone">Phone</label>
              <input id="customer-phone" className="text-field" type="tel" autoComplete="tel" value={values.phone ?? ""} onChange={(event) => updateValue("phone", event.target.value)} disabled={!editing || saving} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "customer-phone-error" : undefined} />
              {fieldErrors.phone && <p className="field-error" id="customer-phone-error">{fieldErrors.phone}</p>}

              <label className="field-label" htmlFor="customer-company">Company</label>
              <input id="customer-company" className="text-field" autoComplete="organization" value={values.company ?? ""} onChange={(event) => updateValue("company", event.target.value)} disabled={!editing || saving} aria-invalid={Boolean(fieldErrors.company)} aria-describedby={fieldErrors.company ? "customer-company-error" : undefined} />
              {fieldErrors.company && <p className="field-error" id="customer-company-error">{fieldErrors.company}</p>}

              {editing && (
                <div className="management-form-actions">
                  {!isNew && <button className="quiet-button" type="button" disabled={saving} onClick={() => {
                    setEditing(false);
                    setError("");
                    setFieldErrors({});
                    if (customer) setValues({ name: customer.name, email: customer.email ?? "", phone: customer.phone ?? "", company: customer.company ?? "" });
                  }}>Cancel</button>}
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? <><LoaderCircle size={15} className="spin" /> Saving…</> : isNew ? "Create customer" : "Save changes"}
                  </button>
                </div>
              )}
            </form>
          </section>

          {customer && (
            <aside className="management-panel management-side-panel">
              <h2>Workspace record</h2>
              <dl className="management-facts">
                <div><dt>Status</dt><dd><span className={`management-status ${customer.isActive ? "is-active" : "is-inactive"}`}>{customer.isActive ? "Active" : "Inactive"}</span></dd></div>
                <div><dt>Added</dt><dd>{formatDate(customer.createdAt)}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(customer.updatedAt)}</dd></div>
              </dl>
              <button className="quiet-button management-status-button" type="button" disabled={busyStatus} onClick={() => void toggleStatus()}>
                {busyStatus ? <LoaderCircle size={14} className="spin" /> : null}
                {customer.isActive ? "Deactivate customer" : "Reactivate customer"}
              </button>
              <p className="management-note">
                Customer deletion is not offered here because the backend cascades customer removal to their tickets.
              </p>
            </aside>
          )}
        </div>
      )}
      {!loading && !isNew && !customer && !error && (
        <div className="management-empty"><Building2 size={22} /><h2>Customer unavailable</h2><p>This customer may have been removed or is outside this workspace.</p></div>
      )}
    </AppShell>
  );
}
