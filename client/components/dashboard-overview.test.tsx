import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { DashboardOverview } from "./dashboard-overview";
import type { AnalyticsOverview, AnalyticsRange } from "@/lib/dashboard-data";

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

function makeOverview(
  range: AnalyticsRange = "30d",
  totalTickets = 12,
): AnalyticsOverview {
  return {
    range,
    generatedAt: "2026-11-25T10:00:00.000Z",
    kpis: {
      totalTickets,
      openCount: totalTickets === 0 ? 0 : 5,
      inProgressCount: totalTickets === 0 ? 0 : 3,
      resolvedCount: totalTickets === 0 ? 0 : 2,
      closedCount: totalTickets === 0 ? 0 : 2,
      unassignedCount: totalTickets === 0 ? 0 : 1,
      slaBreachedCount: totalTickets === 0 ? 0 : 1,
      slaOnTrackCount: totalTickets === 0 ? 0 : 11,
      slaCompliancePercent: totalTickets === 0 ? 100 : 91.7,
      avgFirstResponseMinutes: totalTickets === 0 ? null : 18,
      avgResolutionMinutes: totalTickets === 0 ? null : 120,
    },
    volumeSeries: [
      { date: "2026-11-24", created: 4, resolved: 2 },
      { date: "2026-11-25", created: 3, resolved: 2 },
    ],
    byPriority:
      totalTickets === 0
        ? { urgent: 0, high: 0, medium: 0, low: 0 }
        : { urgent: 2, high: 4, medium: 4, low: 2 },
    byStatus:
      totalTickets === 0
        ? { open: 0, in_progress: 0, resolved: 0, closed: 0 }
        : { open: 5, in_progress: 3, resolved: 2, closed: 2 },
    workload:
      totalTickets === 0
        ? []
        : [
            {
              id: "team-1",
              name: "Tier 1 Support",
              kind: "team",
              openCount: 4,
              resolvedCount: 2,
              slaBreachedCount: 0,
            },
          ],
    aiPerformance: {
      agentDraftRequests: 6,
      customerQaRequests: 10,
      totalRequests: 16,
      avgConfidenceScore: 0.86,
      customerHandoffRate: 20,
      aiDeflectionRate: 80,
      totalPromptTokens: 1200,
      totalCompletionTokens: 300,
      topHelpfulArticles: [
        {
          id: "kb-1",
          title: "Resetting your password",
          slug: "resetting-your-password",
          helpfulCount: 14,
          notHelpfulCount: 1,
        },
      ],
    },
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
    let attempts = 0;

    globalThis.fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(
          { error: { message: "Analytics service temporarily unavailable." } },
          503,
        );
      }
      return jsonResponse({ success: true, data: makeOverview("30d", 0) });
    };

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<DashboardOverview />);
    });
    await act(async () => {
      await flushEffects();
    });

    const alert = renderer?.root.findByProps({ role: "alert" });
    assert.ok(alert);
    assert.match(
      textContent(alert),
      /Analytics service temporarily unavailable/u,
    );

    const retryButton = renderer?.root.find(
      (node) => node.type === "button" && textContent(node).includes("Try again"),
    );
    await act(async () => {
      retryButton?.props.onClick();
    });
    await act(async () => {
      await flushEffects();
    });

    assert.equal(attempts, 2);
    assert.ok(
      renderer?.root.findByProps({
        children: "Your workspace is ready for its first ticket",
      }),
    );
  });

  it("renders KPI cards, workload, AI performance, and switches analytics ranges", async () => {
    installBrowserGlobals();
    const requestedUrls: string[] = [];

    globalThis.fetch = async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      const range: AnalyticsRange = url.includes("range=7d") ? "7d" : "30d";
      return jsonResponse({ success: true, data: makeOverview(range, 12) });
    };

    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(<DashboardOverview />);
    });
    await act(async () => {
      await flushEffects();
    });

    assert.match(requestedUrls[0] ?? "", /\/analytics\/overview\?range=30d$/u);
    const renderedText = renderer ? textContent(renderer.root) : "";
    assert.match(renderedText, /91\.7%/u);
    assert.match(renderedText, /80%/u);
    assert.ok(renderer?.root.findByProps({ children: "Tier 1 Support" }));
    assert.ok(renderer?.root.findByProps({ children: "Resetting your password" }));

    const sevenDayButton = renderer?.root.findByProps({ children: "7 days" });
    await act(async () => {
      sevenDayButton?.props.onClick();
    });
    await act(async () => {
      await flushEffects();
    });

    assert.match(requestedUrls[1] ?? "", /\/analytics\/overview\?range=7d$/u);
  });
});
