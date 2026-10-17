import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import type {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery,
  PaginatedTicketResponse,
  TicketResponse,
  TicketStatusInput,
  UpdateTicketInput,
} from "../types/ticket.types.js";

const ticketNotFound = (): AppError =>
  new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

const customerNotFound = (): AppError =>
  new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

const customerInactive = (): AppError =>
  new AppError(
    409,
    "CUSTOMER_INACTIVE",
    "Tickets can only be linked to active customers",
  );

const assigneeNotFound = (): AppError =>
  new AppError(404, "ASSIGNEE_NOT_FOUND", "Assignee not found");

const assigneeInactive = (): AppError =>
  new AppError(
    409,
    "ASSIGNEE_INACTIVE",
    "Tickets can only be assigned to active agents",
  );

const assigneeNotAgent = (): AppError =>
  new AppError(
    409,
    "ASSIGNEE_NOT_AGENT",
    "Tickets can only be assigned to agents",
  );

const validateTicketCustomer = async (
  organizationId: string,
  customerId: string,
): Promise<void> => {
  const customer = await ticketRepository.findCustomerInOrganization(
    organizationId,
    customerId,
  );

  if (!customer) {
    throw customerNotFound();
  }

  if (!customer.isActive) {
    throw customerInactive();
  }
};

const toTicketResponse = (ticket: TicketResponse): TicketResponse => ({
  id: ticket.id,
  organizationId: ticket.organizationId,
  customerId: ticket.customerId,
  assignedTo: ticket.assignedTo,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

export const ticketService = {
  async listTickets(
    organizationId: string,
    query: ListTicketsQuery,
  ): Promise<PaginatedTicketResponse> {
    const result = await ticketRepository.listInOrganization(
      organizationId,
      query,
    );

    return {
      items: result.items.map(toTicketResponse),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  },

  async getTicket(
    organizationId: string,
    ticketId: string,
  ): Promise<TicketResponse> {
    const ticket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );

    if (!ticket) {
      throw ticketNotFound();
    }

    return toTicketResponse(ticket);
  },

  async createTicket(
    organizationId: string,
    input: CreateTicketInput,
  ): Promise<TicketResponse> {
    await validateTicketCustomer(organizationId, input.customerId);

    const ticket = await ticketRepository.create(organizationId, input);

    if (!ticket) {
      throw new AppError(
        500,
        "TICKET_CREATION_FAILED",
        "Failed to create ticket",
      );
    }

    return toTicketResponse(ticket);
  },

  async updateTicket(
    organizationId: string,
    ticketId: string,
    input: UpdateTicketInput,
  ): Promise<TicketResponse> {
    const existingTicket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );

    if (!existingTicket) {
      throw ticketNotFound();
    }

    if (input.customerId !== undefined) {
      await validateTicketCustomer(organizationId, input.customerId);
    }

    const ticket = await ticketRepository.updateInOrganization(
      organizationId,
      ticketId,
      input,
    );

    if (!ticket) {
      throw ticketNotFound();
    }

    return toTicketResponse(ticket);
  },

  async updateTicketStatus(
    organizationId: string,
    ticketId: string,
    input: TicketStatusInput,
  ): Promise<TicketResponse> {
    const ticket = await ticketRepository.updateStatusInOrganization(
      organizationId,
      ticketId,
      input.status,
    );

    if (!ticket) {
      throw ticketNotFound();
    }

    return toTicketResponse(ticket);
  },

  async assignTicket(
    organizationId: string,
    ticketId: string,
    input: AssignTicketInput,
  ): Promise<TicketResponse> {
    const existingTicket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );

    if (!existingTicket) {
      throw ticketNotFound();
    }

    if (input.assignedTo === null) {
      const ticket = await ticketRepository.updateAssignmentInOrganization(
        organizationId,
        ticketId,
        null,
      );

      if (!ticket) {
        throw ticketNotFound();
      }

      return toTicketResponse(ticket);
    }

    const assignee = await ticketRepository.findUserInOrganization(
      organizationId,
      input.assignedTo,
    );

    if (!assignee) {
      throw assigneeNotFound();
    }

    if (assignee.role !== "agent") {
      throw assigneeNotAgent();
    }

    if (!assignee.isActive) {
      throw assigneeInactive();
    }

    const ticket = await ticketRepository.updateAssignmentInOrganization(
      organizationId,
      ticketId,
      assignee.id,
    );

    if (!ticket) {
      const currentTicket = await ticketRepository.findByIdInOrganization(
        organizationId,
        ticketId,
      );

      if (!currentTicket) {
        throw ticketNotFound();
      }

      const currentAssignee = await ticketRepository.findUserInOrganization(
        organizationId,
        assignee.id,
      );

      if (!currentAssignee) {
        throw assigneeNotFound();
      }

      if (currentAssignee.role !== "agent") {
        throw assigneeNotAgent();
      }

      if (!currentAssignee.isActive) {
        throw assigneeInactive();
      }

      throw new AppError(
        500,
        "TICKET_ASSIGNMENT_FAILED",
        "Failed to assign ticket",
      );
    }

    return toTicketResponse(ticket);
  },
};
