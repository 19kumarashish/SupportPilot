
import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { ticketService } from "./services/ticket.service.js";
import {
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  ticketStatusSchema,
  updateTicketSchema,
  archiveTicketSchema,
  deleteTicketSchema,
  bulkTicketActionSchema,
} from "./validators/ticket.validators.js";
import { ticketRepository } from "./repositories/ticket.repository.js";

const validationError = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid ticket data");

export const listTickets: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsedQuery = listTicketsQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    throw validationError();
  }

  const result = await ticketService.listTickets(
    organizationId,
    parsedQuery.data,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
};

export const getTicket: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    throw validationError();
  }

  const ticket = await ticketService.getTicket(
    organizationId,
    parsedParams.data.id,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};

export const createTicket: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsedInput = createTicketSchema.safeParse(request.body);

  if (!parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.createTicket(
    organizationId,
    parsedInput.data,
  );

  response.status(201).json({
    success: true,
    data: { ticket },
  });
};

export const updateTicket: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);
  const parsedInput = updateTicketSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.updateTicket(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};

export const updateTicketStatus: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const { organizationId } = tenant;
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);
  const parsedInput = ticketStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.updateTicketStatus(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
    tenant.userId,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};

export const assignTicket: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const { organizationId } = tenant;
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);
  const parsedInput = assignTicketSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.assignTicket(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
    tenant.userId,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};

export const setTicketArchive: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = ticketIdParamsSchema.safeParse(request.params);
  const body = archiveTicketSchema.safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const ticket = await ticketRepository.setArchiveInOrganization(
    tenant.organizationId, params.data.id, body.data.archived, tenant.userId,
  );
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  response.json({ success: true, data: { ticket } });
};

export const setTicketDeleted: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = ticketIdParamsSchema.safeParse(request.params);
  const body = deleteTicketSchema.safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const ticket = await ticketRepository.setDeletedInOrganization(
    tenant.organizationId, params.data.id, tenant.userId, body.data.delete,
  );
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  response.json({ success: true, data: { ticket } });
};

export const bulkTicketAction: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const body = bulkTicketActionSchema.safeParse(request.body);
  if (!body.success) throw validationError();
  const result = await ticketRepository.bulkActionInOrganization(
    tenant.organizationId,
    tenant.userId,
    body.data.ticketIds,
    body.data.action,
    {
      ...(body.data.assignedTo !== undefined && { assignedTo: body.data.assignedTo }),
      ...(body.data.assignedTeamId !== undefined && { assignedTeamId: body.data.assignedTeamId }),
      ...(body.data.tagIds !== undefined && { tagIds: body.data.tagIds }),
      ...(body.data.status !== undefined && { status: body.data.status }),
      ...(body.data.priority !== undefined && { priority: body.data.priority }),
    },
  );
  if (!result.success) throw new AppError(404, "TICKET_OR_ASSIGNEE_NOT_FOUND", "Tickets or assignee were not found in this organization");
  response.json({ success: true, data: result });
};

export const getTicketActivity: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = ticketIdParamsSchema.safeParse(request.params);
  if (!params.success) throw validationError();
  const ticket = await ticketRepository.findByIdInOrganization(tenant.organizationId, params.data.id);
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  response.json({
    success: true,
    data: {
      activity: await ticketRepository.activityInOrganization(tenant.organizationId, params.data.id),
      assignmentHistory: await ticketRepository.assignmentHistoryInOrganization(tenant.organizationId, params.data.id),
    },
  });
};
