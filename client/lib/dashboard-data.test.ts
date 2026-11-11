import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizeTickets } from "./dashboard-data";
import type { PageResult, Ticket } from "./ticket-types";

const ticket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  organizationId: "organization-1",
  customerId: "customer-1",
  assignedTo: null,
  subject: "Example ticket",
  description: "An example support request",
  status: "open",
  priority: "medium",
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  ...overrides,
});

describe("summarizeTickets", () => {
  it("keeps the API total separate from counts derived from the returned page", () => {
    const result: PageResult<Ticket> = {
      items: [
        ticket({ status: "open", priority: "urgent" }),
        ticket({ id: "ticket-2", status: "open", priority: "high" }),
        ticket({ id: "ticket-3", status: "resolved", priority: "high" }),
      ],
      page: 1,
      limit: 100,
      total: 248,
      totalPages: 3,
    };

    assert.deepEqual(summarizeTickets(result), {
      total: 248,
      sampleSize: 3,
      byStatus: {
        open: 2,
        in_progress: 0,
        resolved: 1,
        closed: 0,
      },
      byPriority: {
        urgent: 1,
        high: 2,
        medium: 0,
        low: 0,
      },
    });
  });

  it("returns zeroed status and priority counts for an empty page", () => {
    const result: PageResult<Ticket> = {
      items: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 0,
    };

    assert.deepEqual(summarizeTickets(result), {
      total: 0,
      sampleSize: 0,
      byStatus: {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      },
      byPriority: {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });
  });
});
