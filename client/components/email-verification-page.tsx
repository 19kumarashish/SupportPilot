"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { z } from "zod";

import { ApiError, apiJson } from "@/lib/api";

const resendSchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  email: z.string().trim().toLowerCase().email().max(255),
});

interface VerificationResult {
  organization: { name: string; slug: string };
  admin: { email: string };
}

export function EmailVerificationPage({ token }: { token: string }) {
  const [message, setMessage] = useState(
    token ? "Verifying your email address…" : "This verification link is missing its token.",
  );
  const [error, setError] = useState(!token);
  const [resendValues, setResendValues] = useState({
    organizationSlug: "",
    email: "",
  });
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const verificationRequest = useRef<{
    token: string;
    promise: Promise<{ data: VerificationResult }>;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    if (verificationRequest.current?.token !== token) {
      verificationRequest.current = {
        token,
        promise: apiJson<{ data: VerificationResult }>(
          "/auth/verify-organization-signup",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        ),
      };
    }

    verificationRequest.current.promise.then(({ data }) => {
      if (active) {
        setMessage(
          `Email verified. ${data.organization.name} is ready. Sign in with ${data.admin.email}.`,
        );
      }
    }).catch((cause: unknown) => {
      if (active) {
        setMessage(
          cause instanceof ApiError
            ? cause.message
            : "Could not verify this link. Check the API connection and try again.",
        );
        setError(true);
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendMessage("");
    setResendError("");
    const parsed = resendSchema.safeParse(resendValues);
    if (!parsed.success) {
      setResendError("Enter a valid workspace slug and email address.");
      return;
    }

    setResending(true);
    try {
      const result = await apiJson<{ data: { message: string } }>(
        "/auth/organization-signup/resend-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
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
          <p className="eyebrow">SECURE WORKSPACE SETUP</p>
          <h1>One last step<br />to get started.</h1>
          <p className="brand-description">
            Confirm your email address to activate the workspace and its first administrator.
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
          <p className="eyebrow form-eyebrow">EMAIL VERIFICATION</p>
          <h2>{error ? "Couldn’t verify" : "Confirm your email"}</h2>
          <p className={error ? "form-alert" : "login-intro"} role={error ? "alert" : "status"}>
            {message}
          </p>
          {error && (
            <>
              <p className="login-intro">
                Email verification is required before login. If this link expired or the API restarted,
                request a fresh link. If the reservation has expired, submit signup again with the same details.
              </p>
              <form className="login-form" onSubmit={handleResend} noValidate>
                <label className="field-label" htmlFor="resendOrganizationSlug">Workspace slug</label>
                <input
                  id="resendOrganizationSlug"
                  className="text-field"
                  autoComplete="organization"
                  value={resendValues.organizationSlug}
                  onChange={(event) =>
                    setResendValues((current) => ({
                      ...current,
                      organizationSlug: event.target.value,
                    }))
                  }
                  required
                />
                <label className="field-label" htmlFor="resendEmail">Signup email</label>
                <input
                  id="resendEmail"
                  className="text-field"
                  type="email"
                  autoComplete="email"
                  value={resendValues.email}
                  onChange={(event) =>
                    setResendValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
                {resendMessage && <p className="login-intro" role="status">{resendMessage}</p>}
                {resendError && <p className="form-alert" role="alert">{resendError}</p>}
                <button className="primary-button login-submit" type="submit" disabled={resending}>
                  {resending ? "Requesting…" : "Resend verification email"}
                </button>
              </form>
            </>
          )}
          <p className="login-security"><Link href="/">Continue to sign in</Link></p>
        </div>
        <footer className="login-footer">
          <span>© {new Date().getFullYear()} SupportPilot</span>
          <span>Built for better support</span>
        </footer>
      </section>
    </main>
  );
}
