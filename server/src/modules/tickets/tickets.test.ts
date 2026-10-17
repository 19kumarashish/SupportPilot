import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ticketRepository } from "./repositories/ticket.repository.js";
import { ticketService } from "./services/ticket.service.js";
import type { TicketResponse } from "./types/ticket.types.js";
import {
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketStatusSchema,
  updateTicketSchema,
} from "./validators/ticket.validators.js";

const organizationId = "bd288f02-9baf-4551-a278-e09f2adabf00";
const customerId = "f0838fa6-7b5d-45f2-9584-166ac0c498bf";
const agentId = "c46ae685-5d3a-4380-a23b-580ed8571540";

const ticketFixture: TicketResponse = {
  id: "20149f54-3fe5-4d8c-b223-4053470f2bd9",
  organizationId,
  customerId,
  assignedTo: null,
  subject: "Cannot access account",
  description: "Account sign-in fails",
  status: "open",
  priority: "medium",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ticket validators", () => {
  it("validates ticket fields, enums, and rejects client organization IDs", () => {
    assert.equal(
      createTicketSchema.safeParse({
        customerId,
        subject: " Subject ",
        description: " Description ",
      }).success,
      true,
    );

    assert.equal(
      createTicketSchema.safeParse({
        customerId,
        subject: "Subject",
        description: "Description",
        organizationId,
      }).success,
      false,
    );
    assert.equal(
      createTicketSchema.safeParse({
        customerId,
        subject: "Subject",
        description: "x".repeat(10_001),
      }).success,
      false,
    );

    assert.equal(
      createTicketSchema.safeParse({
        customerId,
        subject: "Subject",
        description: "Description",
        status: "pending",
      }).success,
      false,
    );
    assert.equal(
      ticketStatusSchema.safeParse({ status: "closed" }).success,
      true,
    );
    assert.equal(
      ticketStatusSchema.safeParse({ status: "pending" }).success,
      false,
    );
  });

  it("validates pagination and supported filters", () => {
    assert.deepEqual(
      listTicketsQuerySchema.parse({
        page: "2",
        limit: "10",
        status: "in_progress",
        priority: "high",
        customerId,
      }),
      {
        page: 2,
        limit: 10,
        status: "in_progress",
        priority: "high",
        customerId,
      },
    );

    assert.equal(
      listTicketsQuerySchema.safeParse({ limit: "101" }).success,
      false,
    );
    assert.equal(
      listTicketsQuerySchema.safeParse({ status: "pending" }).success,
      false,
    );
  });

  it("requires at least one supported ticket update field", () => {
    assert.equal(updateTicketSchema.safeParse({}).success, false);
    assert.equal(
      updateTicketSchema.safeParse({ subject: "Updated subject" }).success,
      true,
    );
  });

  it("accepts assignments and unassignments but rejects malformed or extra data", () => {
    assert.deepEqual(
      assignTicketSchema.parse({ assignedTo: agentId }),
      { assignedTo: agentId },
    );
    assert.deepEqual(
      assignTicketSchema.parse({ assignedTo: null }),
      { assignedTo: null },
    );
    assert.equal(
      assignTicketSchema.safeParse({ assignedTo: "not-a-uuid" }).success,
      false,
    );
    assert.equal(
      assignTicketSchema.safeParse({
        assignedTo: agentId,
        organizationId,
      }).success,
      false,
    );
  });
});

describe("ticket service customer and tenant checks", () => {
  it("creates under the supplied tenant only after finding an active tenant customer", async (context) => {
    context.mock.method(
      ticketRepository,
      "findCustomerInOrganization",
      async (
        requestedOrganizationId: string,
        requestedCustomerId: string,
      ) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedCustomerId, customerId);
        return { id: customerId, isActive: true };
      },
    );

    const create = context.mock.method(
      ticketRepository,
      "create",
      async (requestedOrganizationId: string) => {
        assert.equal(requestedOrganizationId, organizationId);
        return ticketFixture;
      },
    );

    const result = await ticketService.createTicket(organizationId, {
      customerId,
      subject: ticketFixture.subject,
      description: ticketFixture.description,
    });

    assert.equal(result.organizationId, organizationId);
    assert.equal(result.customerId, customerId);
    assert.equal(create.mock.callCount(), 1);
  });

  it("does not create for a customer outside the organization", async (context) => {
    context.mock.method(
      ticketRepository,
      "findCustomerInOrganization",
      async () => null,
    );
    const create = context.mock.method(
      ticketRepository,
      "create",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.createTicket(organizationId, {
        customerId,
        subject: ticketFixture.subject,
        description: ticketFixture.description,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "CUSTOMER_NOT_FOUND",
    );

    assert.equal(create.mock.callCount(), 0);
  });

  it("does not create tickets for inactive customers", async (context) => {
    context.mock.method(
      ticketRepository,
      "findCustomerInOrganization",
      async () => ({ id: customerId, isActive: false }),
    );
    const create = context.mock.method(
      ticketRepository,
      "create",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.createTicket(organizationId, {
        customerId,
        subject: ticketFixture.subject,
        description: ticketFixture.description,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "CUSTOMER_INACTIVE",
    );

    assert.equal(create.mock.callCount(), 0);
  });

  it("rejects a customer change to an inactive customer", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => ticketFixture,
    );
    context.mock.method(
      ticketRepository,
      "findCustomerInOrganization",
      async () => ({ id: customerId, isActive: false }),
    );
    const update = context.mock.method(
      ticketRepository,
      "updateInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.updateTicket(organizationId, ticketFixture.id, {
        customerId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "CUSTOMER_INACTIVE",
    );

    assert.equal(update.mock.callCount(), 0);
  });

  it("does not inspect a customer when the ticket is outside the organization", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => null,
    );
    const customerLookup = context.mock.method(
      ticketRepository,
      "findCustomerInOrganization",
      async () => ({ id: customerId, isActive: true }),
    );
    const update = context.mock.method(
      ticketRepository,
      "updateInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.updateTicket(organizationId, ticketFixture.id, {
        customerId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "TICKET_NOT_FOUND",
    );

    assert.equal(customerLookup.mock.callCount(), 0);
    assert.equal(update.mock.callCount(), 0);
  });

  it("changes status through the organization-scoped repository operation", async (context) => {
    const updateStatus = context.mock.method(
      ticketRepository,
      "updateStatusInOrganization",
      async (
        requestedOrganizationId: string,
        requestedTicketId: string,
        status: TicketResponse["status"],
      ) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedTicketId, ticketFixture.id);
        assert.equal(status, "resolved");
        return { ...ticketFixture, status };
      },
    );

    const result = await ticketService.updateTicketStatus(
      organizationId,
      ticketFixture.id,
      { status: "resolved" },
    );

    assert.equal(result.status, "resolved");
    assert.equal(updateStatus.mock.callCount(), 1);
  });
});

describe("ticket service assignment and tenant checks", () => {
  it("assigns a ticket to an active agent in the same organization", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async (requestedOrganizationId: string, requestedTicketId: string) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedTicketId, ticketFixture.id);
        return ticketFixture;
      },
    );
    context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async (requestedOrganizationId: string, requestedUserId: string) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedUserId, agentId);
        return { id: agentId, role: "agent" as const, isActive: true };
      },
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async (
        requestedOrganizationId: string,
        requestedTicketId: string,
        assignedTo: string | null,
      ) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedTicketId, ticketFixture.id);
        assert.equal(assignedTo, agentId);
        return { ...ticketFixture, assignedTo };
      },
    );

    const result = await ticketService.assignTicket(
      organizationId,
      ticketFixture.id,
      { assignedTo: agentId },
    );

    assert.equal(result.assignedTo, agentId);
    assert.equal(updateAssignment.mock.callCount(), 1);
  });

  it("rejects a missing or cross-organization assignee without updating", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => ticketFixture,
    );
    context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async () => null,
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.assignTicket(organizationId, ticketFixture.id, {
        assignedTo: agentId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ASSIGNEE_NOT_FOUND",
    );

    assert.equal(updateAssignment.mock.callCount(), 0);
  });

  it("rejects inactive agents without updating", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => ticketFixture,
    );
    context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async () => ({ id: agentId, role: "agent" as const, isActive: false }),
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.assignTicket(organizationId, ticketFixture.id, {
        assignedTo: agentId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ASSIGNEE_INACTIVE",
    );

    assert.equal(updateAssignment.mock.callCount(), 0);
  });

  it("rejects admins as assignees without updating", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => ticketFixture,
    );
    context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async () => ({ id: agentId, role: "admin" as const, isActive: true }),
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.assignTicket(organizationId, ticketFixture.id, {
        assignedTo: agentId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ASSIGNEE_NOT_AGENT",
    );

    assert.equal(updateAssignment.mock.callCount(), 0);
  });

  it("unassigns a ticket without checking a user", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => ticketFixture,
    );
    const userLookup = context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async () => null,
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async (
        requestedOrganizationId: string,
        requestedTicketId: string,
        assignedTo: string | null,
      ) => {
        assert.equal(requestedOrganizationId, organizationId);
        assert.equal(requestedTicketId, ticketFixture.id);
        assert.equal(assignedTo, null);
        return ticketFixture;
      },
    );

    const result = await ticketService.assignTicket(
      organizationId,
      ticketFixture.id,
      { assignedTo: null },
    );

    assert.equal(result.assignedTo, null);
    assert.equal(userLookup.mock.callCount(), 0);
    assert.equal(updateAssignment.mock.callCount(), 1);
  });

  it("does not inspect assignees or update tickets outside the organization", async (context) => {
    context.mock.method(
      ticketRepository,
      "findByIdInOrganization",
      async () => null,
    );
    const userLookup = context.mock.method(
      ticketRepository,
      "findUserInOrganization",
      async () => ({ id: agentId, role: "agent" as const, isActive: true }),
    );
    const updateAssignment = context.mock.method(
      ticketRepository,
      "updateAssignmentInOrganization",
      async () => ticketFixture,
    );

    await assert.rejects(
      ticketService.assignTicket(organizationId, ticketFixture.id, {
        assignedTo: agentId,
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "TICKET_NOT_FOUND",
    );

    assert.equal(userLookup.mock.callCount(), 0);
    assert.equal(updateAssignment.mock.callCount(), 0);
  });
});
