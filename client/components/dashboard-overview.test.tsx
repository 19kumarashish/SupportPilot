import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { DashboardOverview } from "./dashboard-overview";
import type { PageResult, Ticket } from "@/lib/ticket-types";

const originalFetch = globalThis.fetch;
const originalGlobals = new Map(
  [
    "window",
    "self",
    "requestIdleCallback",
    "cancelIdleCallback",
    "IS_REACT_ACT_ENVIRONMENT",
  ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
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

function installBrowserGlobals() {
  Object.defineProperty(globalThis, "self", {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: () => null,
        setItem() {},
        removeItem() {},
      },
      dispatchEvent() {},
    },
  });
  Object.defineProperty(globalThis, "requestIdleCallback", {
    configurable: true,
    value: (
      callback: (deadline: {
        didTimeout: boolean;
        timeRemaining: () => number;
      }) => void,
    ) =>
      setTimeout(
        () => callback({ didTimeout: false, timeRemaining: () => 0 }),
        0,
      ),
  });
  Object.defineProperty(globalThis, "cancelIdleCallback", {
    configurable: true,
    value: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
}

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    organizationId: "organization-1",
    customerId: "customer-1",
    assignedTo: null,
    subject: "Cannot access account",
    description: "The sign-in page reports an error.",
    status: "open",
    priority: "high",
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

function pageResult(items: Ticket[], total = items.length): PageResult<Ticket> {
  return {
    items,
    page: 1,
    limit: 100,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / 100),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function flushEffects() {
  await new Promise((resolve) => setImmediate(resolve));
}

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map((child) =>
      typeof child === "string" ? child : textContent(child),
    )
    .join("");
}

describe("DashboardOverview", () => {
  it("shows loading, an actionable error, and can retry into an empty state", async () => {
    installBrowserGlobals();
    const responses: Array<(response: Response) => void> = [];
    let requestCount = 0;
    globalThis.fetch = (() => {
      requestCount += 1;
      return new Promise<Response>((resolve) => responses.push(resolve));
    }) as typeof fetch;

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<DashboardOverview />);
      await Promise.resolve();
    });

    assert.equal(requestCount, 1);
    assert.match(
      textContent(renderer!.root.findByProps({ role: "status" })),
      /Loading ticket overview/u,
    );

    await act(async () => {
      responses[0]?.(
        jsonResponse(
          { error: { message: "Ticket service is temporarily unavailable." } },
          503,
        ),
      );
      await flushEffects();
    });

    assert.match(
      textContent(renderer!.root.findByProps({ role: "alert" })),
      /Ticket service is temporarily unavailable/u,
    );

    await act(async () => {
      renderer?.root.findByType("button").props.onClick();
      await Promise.resolve();
    });
    assert.equal(requestCount, 2);
    assert.ok(renderer?.root.findByProps({ role: "status" }));

    await act(async () => {
      responses[1]?.(jsonResponse({ data: pageResult([]) }));
      await flushEffects();
    });

    assert.match(
      renderer?.root.findByType("h2").children.join("") ?? "",
      /first ticket/u,
    );
    await act(async () => renderer?.unmount());
  });

  it("renders recent ticket links and sampled breakdowns from the API page", async () => {
    installBrowserGlobals();
    const recent = ticket();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/api/v1/tickets");
      assert.equal(url.search, "?page=1&limit=100");
      return jsonResponse({
        data: pageResult(
          [
            recent,
            ticket({
              id: "ticket-2",
              status: "resolved",
              priority: "urgent",
            }),
          ],
          250,
        ),
      });
    }) as typeof fetch;

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<DashboardOverview />);
      await flushEffects();
    });

    const ticketLink = renderer?.root.findByProps({
      href: `/tickets/${recent.id}`,
    });
    assert.equal(ticketLink?.findByType("strong").children.join(""), recent.subject);
    assert.ok(renderer?.root.findByProps({ children: "250" }));
    assert.match(textContent(renderer!.root), /Counts from the latest 2 tickets/u);
    assert.match(textContent(renderer!.root), /Latest 2 tickets/u);
    assert.equal(
      renderer?.root.findAllByProps({ className: "dashboard-stat-card" }).length,
      4,
    );
    await act(async () => renderer?.unmount());
  });
});
