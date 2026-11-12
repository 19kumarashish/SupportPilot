"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";

export function PortalLogin() {
  const router = useRouter();
  const { signIn } = useCustomerAuth();
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn({ organizationSlug, email, password });
      router.replace("/portal");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="portal-page">
      <section className="management-panel portal-card">
        <p className="eyebrow">CUSTOMER PORTAL</p>
        <h1>Sign in to SupportPilot</h1>
        <form className="management-form" onSubmit={submit}>
          {error && <p className="field-error" role="alert">{error}</p>}
          <label className="field-label" htmlFor="portal-workspace">Workspace</label>
          <input id="portal-workspace" className="text-field" value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value)} required />
          <label className="field-label" htmlFor="portal-email">Email</label>
          <input id="portal-email" className="text-field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label className="field-label" htmlFor="portal-password">Password</label>
          <input id="portal-password" className="text-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
