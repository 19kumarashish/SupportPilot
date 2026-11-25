import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";

import { PortalKbBrowser } from "./portal/portal-kb-browser";
import { draftTicketReply } from "../lib/ai-api";
import { askCustomerAi } from "../lib/customer-ai-api";

const originalActEnvironment = Object.getOwnPropertyDescriptor(
  globalThis,
  "IS_REACT_ACT_ENVIRONMENT",
);
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSelf) {
    Object.defineProperty(globalThis, "self", originalSelf);
  } else {
    Reflect.deleteProperty(globalThis, "self");
  }
  if (originalActEnvironment) {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
  } else {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

describe("AI assistance client helpers and portal handoff", () => {
  it("requests staff AI draft reply with citations", async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            draft: "Please reset your password using the link.",
            confidence: 0.88,
            citations: [
              {
                articleId: "art-1",
                slug: "reset-password",
                title: "Reset Password",
                excerpt: "Click Forgot Password",
                score: 0.92,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await draftTicketReply("ticket-123");
    assert.match(requestedUrl, /\/ai\/tickets\/ticket-123\/draft-reply$/u);
    assert.equal(result.data.confidence, 0.88);
    assert.equal(result.data.citations[0]?.title, "Reset Password");
  });

  it("returns customer AI handoff payload when confidence is low", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            handedOff: true,
            message: "I could not find a confident answer. Please open a ticket.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await askCustomerAi("obscure billing question");
    assert.equal(result.data.handedOff, true);
    assert.match(result.data.message ?? "", /open a ticket/u);
  });

  it("renders customer AI handoff escalation link in PortalKbBrowser", async () => {
    Object.defineProperty(globalThis, "self", {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/customer/ai/ask")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              handedOff: true,
              message: "Let us connect you with a human agent.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, data: { items: [], total: 0 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(<PortalKbBrowser />);
    });

    const input = renderer?.root.findByProps({ id: "portal-ai-question" });
    await act(async () => {
      input?.props.onChange({ target: { value: "How do I change invoice VAT?" } });
    });

    const form = renderer?.root.findByProps({ "aria-label": "Ask SupportPilot AI" });
    await act(async () => {
      await form?.props.onSubmit({ preventDefault: () => undefined });
    });

    assert.ok(renderer?.root.findByProps({ children: "Let us connect you with a human agent." }));
    assert.ok(renderer?.root.findByProps({ href: "/portal/tickets/new" }));
  });
});
