import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { EmailVerificationPage } from "./email-verification-page";

const originalFetch = globalThis.fetch;
const originalGlobals = new Map(
  ["self", "requestIdleCallback", "cancelIdleCallback", "IS_REACT_ACT_ENVIRONMENT"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
  ),
);

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

describe("EmailVerificationPage", () => {
  it("shows success and sends one verification request during Strict Mode effect replay", async () => {
    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "requestIdleCallback", {
      configurable: true,
      value: (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
        setTimeout(
          () => callback({ didTimeout: false, timeRemaining: () => 0 }),
          0,
        ),
    });
    Object.defineProperty(globalThis, "cancelIdleCallback", {
      configurable: true,
      value: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
    });

    let requestCount = 0;
    let resolveResponse: ((response: Response) => void) | undefined;
    globalThis.fetch = (() => {
      requestCount += 1;
      return new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
    }) as typeof fetch;

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <StrictMode>
          <EmailVerificationPage token="test-verification-token" />
        </StrictMode>,
      );
      await Promise.resolve();
    });

    assert.equal(requestCount, 1);
    assert.ok(resolveResponse);

    await act(async () => {
      resolveResponse?.(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              organization: { name: "Test workspace", slug: "test-workspace" },
              admin: { email: "admin@example.test" },
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
      await new Promise((resolve) => setImmediate(resolve));
    });

    assert.equal(requestCount, 1);
    assert.equal(
      renderer?.root.findByType("h2").children.join(""),
      "Confirm your email",
    );
    assert.match(
      renderer?.root.findByProps({ role: "status" }).children.join("") ?? "",
      /Test workspace.*admin@example\.test/,
    );
    await act(async () => renderer?.unmount());
  });

  it("offers a resend request when the verification token is expired", async () => {
    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "requestIdleCallback", {
      configurable: true,
      value: (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
        setTimeout(
          () => callback({ didTimeout: false, timeRemaining: () => 0 }),
          0,
        ),
    });
    Object.defineProperty(globalThis, "cancelIdleCallback", {
      configurable: true,
      value: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
    });

    const requests: Array<{ url: string; body?: string }> = [];
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return Promise.resolve(
        requests.length === 1
          ? new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: "VERIFICATION_TOKEN_EXPIRED",
                  message: "This verification link has expired",
                },
              }),
              { status: 410, headers: { "Content-Type": "application/json" } },
            )
          : new Response(
              JSON.stringify({
                success: true,
                data: {
                  message:
                    "If those details match an unexpired pending signup, check your inbox for a fresh verification link. If it does not arrive, request another link later.",
                },
              }),
              { status: 202, headers: { "Content-Type": "application/json" } },
            ),
      );
    }) as typeof fetch;

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<EmailVerificationPage token="expired-verification-token" />);
      await new Promise((resolve) => setImmediate(resolve));
    });

    assert.match(
      renderer?.root.findByProps({ role: "alert" }).children.join("") ?? "",
      /verification link has expired/u,
    );

    const slug = renderer?.root.findByProps({ id: "resendOrganizationSlug" });
    const email = renderer?.root.findByProps({ id: "resendEmail" });
    assert.ok(slug);
    assert.ok(email);

    await act(async () => {
      slug.props.onChange({ target: { value: "test-workspace" } });
      email.props.onChange({ target: { value: "admin@example.test" } });
    });

    await act(async () => {
      renderer?.root.findByType("form").props.onSubmit({
        preventDefault() {},
      });
      await new Promise((resolve) => setImmediate(resolve));
    });

    assert.equal(requests.length, 2);
    assert.match(requests[1]?.url ?? "", /organization-signup\/resend-verification/u);
    assert.deepEqual(JSON.parse(requests[1]?.body ?? "{}"), {
      organizationSlug: "test-workspace",
      email: "admin@example.test",
    });
    assert.match(
      renderer?.root.findAllByProps({ role: "status" }).at(-1)?.children.join("") ?? "",
      /If the reservation has expired, submit signup again/u,
    );
    await act(async () => renderer?.unmount());
  });
});
