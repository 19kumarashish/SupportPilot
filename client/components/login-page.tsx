"use client";

import { z } from "zod";
import { ArrowUpRight, Eye, EyeOff, LifeBuoy, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const loginSchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Enter your workspace slug.")
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export function LoginPage() {
  const {
    signIn,
    user,
    ready,
    unavailable,
    signOutWarning,
    retrySession,
  } = useAuth();
  const router = useRouter();
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/tickets");
  }, [ready, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = loginSchema.safeParse({ organizationSlug, email, password });
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data);
      router.replace("/tickets");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "INVALID_CREDENTIALS") {
        setError("Those sign-in details don’t match. Check your workspace, email, and password.");
      } else if (cause instanceof ApiError && cause.code === "USER_INACTIVE") {
        setError("This account is inactive. Ask a workspace administrator for access.");
      } else if (cause instanceof TypeError) {
        setError("Couldn’t reach SupportPilot. Check the API connection and try again.");
      } else if (cause instanceof ApiError && cause.status >= 500) {
        setError("SupportPilot is temporarily unavailable. Please try again.");
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
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
          <p className="eyebrow">CUSTOMER SUPPORT, IN FOCUS</p>
          <h1>Every conversation<br />deserves a clear next step.</h1>
          <p className="brand-description">
            A calm, considered workspace for teams who take customer care seriously.
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
          <p className="eyebrow form-eyebrow">YOUR SUPPORT WORKSPACE</p>
          <h2>Welcome back</h2>
          <p className="login-intro">Sign in with your workspace credentials.</p>
          {unavailable && (
            <div className="form-alert" role="alert">
              We couldn’t verify your saved session because SupportPilot is unavailable.
              Your session has been kept.{" "}
              <button type="button" className="text-button" onClick={retrySession}>
                Retry
              </button>
            </div>
          )}
          {signOutWarning && (
            <p className="form-alert" role="alert">{signOutWarning}</p>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="organizationSlug">Workspace slug</label>
            <input
              id="organizationSlug"
              className="text-field"
              autoComplete="organization"
              inputMode="text"
              placeholder="your-company"
              value={organizationSlug}
              onChange={(event) => setOrganizationSlug(event.target.value)}
              aria-invalid={Boolean(fieldErrors.organizationSlug)}
              aria-describedby={fieldErrors.organizationSlug ? "workspace-error" : "workspace-hint"}
              required
            />
            {fieldErrors.organizationSlug ? (
              <p id="workspace-error" className="field-error">{fieldErrors.organizationSlug}</p>
            ) : (
              <p id="workspace-hint" className="field-hint">Enter the workspace slug shared by your team.</p>
            )}

            <label className="field-label" htmlFor="email">Work email</label>
            <input
              id="email"
              className="text-field"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              required
            />
            {fieldErrors.email && <p id="email-error" className="field-error">{fieldErrors.email}</p>}

            <div className="password-label-row">
              <label className="field-label" htmlFor="password">Password</label>
            </div>
            <div className="password-field">
              <LockKeyhole size={16} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && <p id="password-error" className="field-error">{fieldErrors.password}</p>}

            {error && <p className="form-alert" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
              {!submitting && <ArrowUpRight size={16} />}
            </button>
          </form>

          <p className="login-security">
            <LockKeyhole size={13} />
            Secure access to your organization
          </p>
          <p className="login-security"><Link href="/signup">Create a workspace</Link></p>
        </div>
        <footer className="login-footer">
          <span>© {new Date().getFullYear()} SupportPilot</span>
          <span>Built for better support</span>
        </footer>
      </section>
    </main>
  );
}
