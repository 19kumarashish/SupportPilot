"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api";

const signupSchema = z.object({
  organizationName: z.string().trim().min(1).max(255),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const resendSchema = signupSchema.pick({
  organizationSlug: true,
  email: true,
});

const resendPath = "/auth/organization-signup/resend-verification";

export function OrganizationSignupPage() {
  const [values, setValues] = useState({
    organizationName: "",
    organizationSlug: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the signup details.");
      return;
    }

    setSubmitting(true);
    try {
      await apiJson("/auth/organization-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setSubmitted(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.code === "SIGNUP_ALREADY_EXISTS"
          ? "A workspace slug or pending signup conflicts. If you already started signup, use the same workspace and email with Resend verification; otherwise choose a different slug or email. Expired reservations can be reused."
          : cause instanceof ApiError
            ? cause.message
            : "Could not submit signup. Check the API connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendMessage("");
    setResendError("");
    const parsed = resendSchema.safeParse(values);
    if (!parsed.success) {
      setResendError("Enter a valid workspace slug and email address to request a new link.");
      return;
    }

    setResending(true);
    try {
      const result = await apiJson<{ data: { message: string } }>(resendPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setResendMessage(
        `${result.data.message} If the reservation has expired, submit signup again with the same workspace and email.`,
      );
    } catch (cause) {
      setResendError(
        cause instanceof ApiError
          ? cause.message
          : "Could not request a verification email. Check the API connection and try again.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="About SupportPilot">
        <div className="login-brand">
          <span className="brand-symbol"><LifeBuoy size={20} /></span>
          <span>support<span className="brand-light">pilot</span></span>
        </div>
        <div className="brand-message">
          <p className="eyebrow">A CLEARER WAY TO SUPPORT</p>
          <h1>Make space for<br />better conversations.</h1>
          <p className="brand-description">
            Create a workspace for your team and start with a secure, verified administrator account.
          </p>
        </div>
        <div className="brand-panel-footer">
          <span className="brand-rule" />
          <span>Support, made thoughtful.</span>
        </div>
        <span className="brand-orbit orbit-one" aria-hidden="true" />
        <span className="brand-orbit orbit-two" aria-hidden="true" />
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="mobile-login-brand">
            <span className="brand-symbol"><LifeBuoy size={19} /></span>
            <span>support<span className="brand-light">pilot</span></span>
          </div>
          <p className="eyebrow form-eyebrow">CREATE YOUR WORKSPACE</p>
          {submitted ? (
            <>
              <h2>Check your inbox</h2>
              <p className="login-intro">
                If we can complete this signup, we’ll send a verification link to the address you provided.
                Email verification is required before you can sign in. The workspace and administrator
                are created only after verification. This development link is kept in memory and must
                be requested again if the API restarts.
              </p>
              {resendMessage && <p className="login-intro" role="status">{resendMessage}</p>}
              {resendError && <p className="form-alert" role="alert">{resendError}</p>}
              <button
                className="primary-button login-submit"
                type="button"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? "Requesting…" : "Resend verification email"}
              </button>
            </>
          ) : (
            <>
              <h2>Get started</h2>
              <p className="login-intro">
                Set up your company workspace and administrator. You must verify your email before signing in.
              </p>
              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <label className="field-label" htmlFor="organizationName">Company name</label>
                <input
                  id="organizationName"
                  className="text-field"
                  autoComplete="organization"
                  value={values.organizationName}
                  onChange={(event) => setValues({ ...values, organizationName: event.target.value })}
                  required
                />

                <label className="field-label" htmlFor="organizationSlug">Workspace slug</label>
                <input
                  id="organizationSlug"
                  className="text-field"
                  autoComplete="off"
                  placeholder="your-company"
                  value={values.organizationSlug}
                  onChange={(event) => setValues({ ...values, organizationSlug: event.target.value })}
                  required
                />
                <p className="field-hint">Use lowercase letters, numbers, and hyphens.</p>

                <label className="field-label" htmlFor="firstName">Administrator first name</label>
                <input
                  id="firstName"
                  className="text-field"
                  autoComplete="given-name"
                  value={values.firstName}
                  onChange={(event) => setValues({ ...values, firstName: event.target.value })}
                  required
                />

                <label className="field-label" htmlFor="lastName">Administrator last name</label>
                <input
                  id="lastName"
                  className="text-field"
                  autoComplete="family-name"
                  value={values.lastName}
                  onChange={(event) => setValues({ ...values, lastName: event.target.value })}
                  required
                />

                <label className="field-label" htmlFor="email">Work email</label>
                <input
                  id="email"
                  className="text-field"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(event) => setValues({ ...values, email: event.target.value })}
                  required
                />

                <label className="field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="text-field"
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(event) => setValues({ ...values, password: event.target.value })}
                  required
                />
                <p className="field-hint">Use at least 8 characters.</p>

                {error && <p className="form-alert" role="alert">{error}</p>}
                {resendMessage && <p className="login-intro" role="status">{resendMessage}</p>}
                {resendError && <p className="form-alert" role="alert">{resendError}</p>}
                <button
                  className="primary-button login-submit"
                  type="submit"
                  disabled={submitting || resending}
                >
                  {submitting ? "Submitting…" : "Create workspace"}
                </button>
                <button
                  className="quiet-button login-submit"
                  type="button"
                  onClick={handleResend}
                  disabled={submitting || resending}
                >
                  {resending ? "Requesting…" : "Already signed up? Resend verification"}
                </button>
              </form>
            </>
          )}
          <p className="login-security">
            <Link href="/">Back to sign in</Link>
          </p>
        </div>
        <footer className="login-footer">
          <span>© {new Date().getFullYear()} SupportPilot</span>
          <span>Built for better support</span>
        </footer>
      </section>
    </main>
  );
}
