
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
} from "./validators/ticket.validators.js";

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
  const { organizationId } = getTenantContext(request);
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);
  const parsedInput = ticketStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.updateTicketStatus(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};

export const assignTicket: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsedParams = ticketIdParamsSchema.safeParse(request.params);
  const parsedInput = assignTicketSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const ticket = await ticketService.assignTicket(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
  );

  response.status(200).json({
    success: true,
    data: { ticket },
  });
};
