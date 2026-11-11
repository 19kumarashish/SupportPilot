"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { apiJson, saveTokens, type SessionTokens } from "@/lib/api";

export function InvitationAcceptancePage({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [values, setValues] = useState({ firstName: "", lastName: "", password: "" });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    apiJson<{ data: { invitation: { email: string } } }>(`/auth/invitations/${encodeURIComponent(token)}`)
      .then(({ data }) => setEmail(data.invitation.email))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "This invitation is no longer available."));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await apiJson<{ data: { tokens: SessionTokens } }>("/auth/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...values }) });
      saveTokens(result.data.tokens);
      setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not accept invitation."); }
  }

  if (complete) return <main className="auth-page"><section className="auth-card"><h1>Invitation accepted</h1><p>Your account is ready. You can now return to the workspace.</p><Link className="primary-button" href="/">Open SupportPilot</Link></section></main>;
  return <main className="auth-page"><form className="auth-card" onSubmit={(event) => void submit(event)}><p className="eyebrow">STAFF INVITATION</p><h1>Join SupportPilot</h1><p>{email || "Checking invitation…"}</p><input className="text-field" placeholder="First name" value={values.firstName} onChange={(event) => setValues({ ...values, firstName: event.target.value })} required /><input className="text-field" placeholder="Last name" value={values.lastName} onChange={(event) => setValues({ ...values, lastName: event.target.value })} required /><input className="text-field" type="password" placeholder="Password" minLength={8} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} required />{error && <div className="inline-alert" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={!email}>Accept invitation</button></form></main>;
}
