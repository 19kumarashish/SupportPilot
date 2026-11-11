import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { loadAllActiveAgents, loadAllCustomers } from "./ticket-data";
import type { Customer, TeamMember, Ticket } from "./ticket-types";
import {
  buildTicketListQuery,
  createTicketSchema,
  filterTicketsOnCurrentPage,
} from "./ticket-workflow";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindow() {
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
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

const customer: Customer = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Example Customer",
  email: "customer@example.test",
  company: "Example Co",
  isActive: true,
};

const ticket: Ticket = {
  id: "00000000-0000-4000-8000-000000000002",
  organizationId: "00000000-0000-4000-8000-000000000003",
  customerId: customer.id,
  assignedTo: null,
  subject: "Cannot access account",
  description: "The sign-in page reports an error.",
  status: "open",
  priority: "high",
  createdAt: "2025-01-01T12:00:00.000Z",
  updatedAt: "2025-01-01T12:00:00.000Z",
};

describe("ticket workflow helpers", () => {
  it("builds only the supported ticket list filters and pagination parameters", () => {
    assert.equal(
      buildTicketListQuery({
        page: 3,
        pageSize: 20,
        status: "in_progress",
        priority: "urgent",
        customerId: customer.id,
      }),
      `page=3&limit=20&status=in_progress&priority=urgent&customerId=${customer.id}`,
    );
    assert.equal(
      buildTicketListQuery({
        page: 1,
        pageSize: 20,
        status: "",
        priority: "",
        customerId: "",
      }),
      "page=1&limit=20",
    );
  });

  it("validates and normalizes fields to the ticket create contract", () => {
    const parsed = createTicketSchema.safeParse({
      customerId: customer.id,
      subject: "  Cannot access account  ",
      description: " The sign-in page reports an error. ",
      priority: "high",
      status: "open",
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.subject, "Cannot access account");
      assert.equal(parsed.data.description, "The sign-in page reports an error.");
    }
    assert.equal(
      createTicketSchema.safeParse({
        customerId: customer.id,
        subject: "Classified issue",
        description: "This needs a category and tags.",
        priority: "medium",
        status: "open",
        categoryId: "dd3fefad-f94e-4b5d-b3d7-4b19f98c8e91",
        tagIds: ["f65e77fd-f1af-4f0d-bc5f-54f70d5ea0c7"],
      }).success,
      true,
    );
    assert.equal(
      createTicketSchema.safeParse({
        customerId: "",
        subject: " ",
        description: "",
        priority: "high",
        status: "open",
      }).success,
      false,
    );
  });

  it("searches only tickets passed from the current page", () => {
    const secondTicket = { ...ticket, id: "ticket-second", subject: "Another issue" };
    const matches = filterTicketsOnCurrentPage(
      [ticket, secondTicket],
      [customer],
      "cannot access account",
    );

    assert.deepEqual(matches, [ticket]);
    assert.deepEqual(filterTicketsOnCurrentPage([ticket], [customer], "  "), [ticket]);
  });

  it("loads all customer pages and keeps active-agent filtering scoped to returned users", async () => {
    installWindow();
    const requests: string[] = [];
    const agent: TeamMember = {
      id: "agent-1",
      firstName: "Avery",
      lastName: "Agent",
      role: "agent",
      isActive: true,
    };
    const inactiveAgent = { ...agent, id: "agent-2", isActive: false };
    const admin: TeamMember = { ...agent, id: "admin-1", role: "admin" };

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(`${url.pathname}${url.search}`);
      if (url.pathname.endsWith("/customers")) {
        const page = Number(url.searchParams.get("page"));
        return new Response(
          JSON.stringify({
            data: {
              items: page === 1 ? [customer] : [{ ...customer, id: "customer-2" }],
              totalPages: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      const page = Number(url.searchParams.get("page"));
      return new Response(
        JSON.stringify({
          data: {
            users: page === 1 ? [agent, inactiveAgent] : [admin],
            pagination: { totalPages: 2 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const customers = await loadAllCustomers();
    const activeAgents = await loadAllActiveAgents();

    assert.equal(customers.length, 2);
    assert.deepEqual(activeAgents, [agent]);
    assert.deepEqual(requests, [
      "/api/v1/customers?page=1&limit=100",
      "/api/v1/customers?page=2&limit=100",
      "/api/v1/users?page=1&limit=100",
      "/api/v1/users?page=2&limit=100",
    ]);
  });
});
