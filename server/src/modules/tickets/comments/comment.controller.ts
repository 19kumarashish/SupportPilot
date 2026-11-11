import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../../../shared/errors/app-error.js";
import { getTenantContext } from "../../../shared/tenant-context.js";
import { ticketCommentService } from "./comment.service.js";
import {
  createTicketCommentSchema,
  listTicketCommentsQuerySchema,
  ticketCommentsParamsSchema,
  updateTicketCommentSchema,
} from "./comment.validators.js";

const validationError = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid ticket comment data");

export const createTicketComment: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketCommentsParamsSchema.safeParse(request.params);
  const parsedInput = createTicketCommentSchema.safeParse(request.body);
  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const comment = await ticketCommentService.create(
    tenant.organizationId,
    parsedParams.data.id,
    tenant.userId,
    tenant.role,
    parsedInput.data,
  );
  response.status(201).json({ success: true, data: { comment } });
};

export const listTicketComments: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketCommentsParamsSchema.safeParse(request.params);
  const parsedQuery = listTicketCommentsQuerySchema.safeParse(request.query);
  if (!parsedParams.success || !parsedQuery.success) {
    throw validationError();
  }

  const result = await ticketCommentService.list(
    tenant.organizationId,
    parsedParams.data.id,
    tenant.role,
    parsedQuery.data,
  );
  response.status(200).json({
    success: true,
    data: {
      comments: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
};

export const updateTicketComment: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = z.object({ id: z.uuid(), commentId: z.uuid() }).strict().safeParse(request.params);
  const body = updateTicketCommentSchema.safeParse(request.body);
  if (!params.success || !body.success) throw validationError();
  const comment = await ticketCommentService.update(
    tenant.organizationId, params.data.id, params.data.commentId,
    tenant.userId, tenant.role, body.data.body,
  );
  response.json({ success: true, data: { comment } });
};

export const deleteTicketComment: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = z.object({ id: z.uuid(), commentId: z.uuid() }).strict().safeParse(request.params);
  if (!params.success) throw validationError();
  const comment = await ticketCommentService.delete(
    tenant.organizationId, params.data.id, params.data.commentId,
    tenant.userId, tenant.role,
  );
  response.json({ success: true, data: { comment } });
};
