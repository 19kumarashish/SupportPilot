import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { getTenantContext } from "../../../shared/tenant-context.js";
import { ticketCommentService } from "./comment.service.js";
import {
  createTicketCommentSchema,
  listTicketCommentsQuerySchema,
  ticketCommentsParamsSchema,
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
