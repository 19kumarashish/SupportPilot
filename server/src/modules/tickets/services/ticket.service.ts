import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { slaService } from "../../sla/services/sla.service.js";
import { calculateSlaDeadlines, defaultSlaWindows } from "../../sla/services/sla-calculator.js";
import type {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery,
  PaginatedTicketResponse,
  TicketResponse,
  TicketStatusInput,
  UpdateTicketInput,
} from "../types/ticket.types.js";
import { teamRepository } from "../../teams/repositories/team.repository.js";

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

const invalidTicketStatusTransition = (): AppError =>
  new AppError(
    409,
    "INVALID_STATUS_TRANSITION",
    "Ticket status transition is not allowed",
  );

type TicketForResponse = Pick<
  TicketResponse,
  "id" | "organizationId" | "customerId" | "assignedTo" | "subject" | "description" | "status" | "priority" | "createdAt" | "updatedAt"
> & {
  assignedTeamId?: string | null;
  firstResponseDeadlineAt?: Date | null;
  resolutionDeadlineAt?: Date | null;
  firstRespondedAt?: Date | null;
  slaBreachedAt?: Date | null;
};

const toTicketSlaStatus = (
  ticket: TicketForResponse,
): Pick<TicketResponse, "slaDeadline" | "responseDeadline" | "slaStatus" | "isSlaBreached"> => {
  const now = new Date();
  const fallback = calculateSlaDeadlines(
    ticket.createdAt instanceof Date ? ticket.createdAt : new Date(ticket.createdAt),
    ticket.priority,
    {
      firstResponseMinutes: defaultSlaWindows[ticket.priority].firstResponseMinutes,
      resolutionMinutes: defaultSlaWindows[ticket.priority].resolutionMinutes,
    },
  );
  const responseDeadline = ticket.firstResponseDeadlineAt ?? fallback.firstResponseDeadlineAt;
  const slaDeadline = ticket.resolutionDeadlineAt ?? fallback.resolutionDeadlineAt;

  if (ticket.status === "resolved" || ticket.status === "closed") {
    return {
      slaDeadline: slaDeadline.toISOString(),
      responseDeadline: responseDeadline.toISOString(),
      slaStatus: "completed",
      isSlaBreached: false,
    };
  }

  const riskWindow = Math.max(
    1,
    slaDeadline.getTime() - (slaDeadline.getTime() - ticket.createdAt.getTime()) * 0.25,
  );
  const withinRiskWindow = now.getTime() >= riskWindow;
  const breached = ticket.slaBreachedAt !== null && ticket.slaBreachedAt !== undefined
    ? true
    : now > slaDeadline;

  return {
    slaDeadline: slaDeadline.toISOString(),
    responseDeadline: responseDeadline.toISOString(),
    slaStatus: breached ? "breached" : withinRiskWindow ? "at_risk" : "on_track",
    isSlaBreached: breached,
  };
};

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

const validateTicketStatusTransition = (
  currentStatus: TicketResponse["status"],
  nextStatus: TicketResponse["status"],
): void => {
  const allowedTransitions: Record<
    TicketResponse["status"],
    TicketResponse["status"][]
  > = {
    open: ["open", "in_progress", "resolved", "closed"],
    in_progress: ["in_progress", "resolved", "closed"],
    resolved: ["resolved", "closed"],
    closed: ["closed", "open", "in_progress"],
  };

  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw invalidTicketStatusTransition();
  }
};

const toTicketResponse = (ticket: TicketForResponse): TicketResponse => ({
  id: ticket.id,
  organizationId: ticket.organizationId,
  customerId: ticket.customerId,
  assignedTo: ticket.assignedTo,
  ...(ticket.assignedTeamId !== undefined && { assignedTeamId: ticket.assignedTeamId }),
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  ...(ticket.firstResponseDeadlineAt && {
    firstResponseDeadlineAt: ticket.firstResponseDeadlineAt.toISOString(),
  }),
  ...(ticket.resolutionDeadlineAt && {
    resolutionDeadlineAt: ticket.resolutionDeadlineAt.toISOString(),
  }),
  ...(ticket.firstRespondedAt && {
    firstRespondedAt: ticket.firstRespondedAt.toISOString(),
  }),
  ...(ticket.slaBreachedAt && {
    slaBreachedAt: ticket.slaBreachedAt.toISOString(),
  }),
  ...toTicketSlaStatus(ticket),
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
    if (input.assignedTeamId && !await teamRepository.findInOrganization(organizationId, input.assignedTeamId)) {
      throw new AppError(404, "TEAM_NOT_FOUND", "Assigned team not found");
    }

    const priority = input.priority ?? "medium";
    const deadlines = await slaService.calculateDeadlines(
      organizationId,
      priority,
      new Date(),
    );
    const ticket = await ticketRepository.create(organizationId, input, deadlines);

    if (!ticket) {
      throw new AppError(
        input.categoryId || input.tagIds?.length
          ? 400
          : 500,
        input.categoryId || input.tagIds?.length
          ? "INVALID_CATEGORY_OR_TAG"
          : "TICKET_CREATION_FAILED",
        input.categoryId || input.tagIds?.length
          ? "Category or tags are invalid for this organization"
          : "Failed to create ticket",
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
    if (input.assignedTeamId && !await teamRepository.findInOrganization(organizationId, input.assignedTeamId)) {
      throw new AppError(404, "TEAM_NOT_FOUND", "Assigned team not found");
    }

    const updatedPriority = input.priority;
    const deadlines = updatedPriority !== undefined
      ? await slaService.calculateDeadlines(
        organizationId,
        updatedPriority,
        existingTicket.createdAt instanceof Date
          ? existingTicket.createdAt
          : new Date(existingTicket.createdAt),
      )
      : undefined;
    const ticket = await ticketRepository.updateInOrganization(
      organizationId,
      ticketId,
      input,
      deadlines,
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
    actorUserId?: string,
  ): Promise<TicketResponse> {
    const currentTicket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );

    if (!currentTicket) {
      throw ticketNotFound();
    }

    validateTicketStatusTransition(currentTicket.status, input.status);

    const ticket = await ticketRepository.updateStatusInOrganization(
      organizationId,
      ticketId,
      input.status,
      actorUserId,
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
    actorUserId?: string,
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
        actorUserId,
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
      actorUserId,
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
