import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import type {
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

const validateTicketCustomer = async (
  organizationId: string,
  customerId: string,
): Promise<void> => {
  const customer =
    await ticketRepository.findCustomerInOrganization(
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
};
