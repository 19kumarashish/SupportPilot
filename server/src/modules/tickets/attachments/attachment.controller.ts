import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { getTenantContext } from "../../../shared/tenant-context.js";
import { ticketService } from "../services/ticket.service.js";
import { ticketAttachmentService } from "./attachment.service.js";
import {
  listTicketAttachmentsQuerySchema,
  ticketAttachmentDownloadParamsSchema,
  ticketAttachmentParamsSchema,
} from "./attachment.validators.js";

const validationError = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid ticket attachment data");

export const authorizeAttachmentTicket: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketAttachmentParamsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    throw validationError();
  }

  await ticketService.getTicket(tenant.organizationId, parsedParams.data.id);
  next();
};

export const uploadTicketAttachment: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketAttachmentParamsSchema.safeParse(request.params);
  if (!parsedParams.success) {
    throw validationError();
  }
  if (!request.file || Object.keys(request.body ?? {}).length > 0) {
    throw new AppError(
      400,
      "INVALID_ATTACHMENT_UPLOAD",
      "Upload one file using the file form field",
    );
  }

  const attachment = await ticketAttachmentService.create(
    tenant.organizationId,
    parsedParams.data.id,
    tenant.userId,
    request.file,
  );
  response.status(201).json({ success: true, data: { attachment } });
};

export const listTicketAttachments: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketAttachmentParamsSchema.safeParse(request.params);
  const parsedQuery = listTicketAttachmentsQuerySchema.safeParse(request.query);
  if (!parsedParams.success || !parsedQuery.success) {
    throw validationError();
  }

  const result = await ticketAttachmentService.list(
    tenant.organizationId,
    parsedParams.data.id,
    parsedQuery.data,
  );
  response.status(200).json({
    success: true,
    data: {
      attachments: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
};

export const downloadTicketAttachment: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketAttachmentDownloadParamsSchema.safeParse(
    request.params,
  );
  if (!parsedParams.success) {
    throw validationError();
  }

  const { attachment, contents } = await ticketAttachmentService.get(
    tenant.organizationId,
    parsedParams.data.id,
    parsedParams.data.attachmentId,
  );
  const filename = attachment.originalFilename.replace(/["\\]/g, "_");
  response.setHeader("Content-Type", attachment.contentType);
  response.setHeader("Content-Length", String(contents.length));
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(200).send(contents);
};

export const deleteTicketAttachment: RequestHandler = async (
  request,
  response,
) => {
  const tenant = getTenantContext(request);
  const parsedParams = ticketAttachmentDownloadParamsSchema.safeParse(
    request.params,
  );
  if (!parsedParams.success) {
    throw validationError();
  }

  await ticketAttachmentService.delete(
    tenant.organizationId,
    parsedParams.data.id,
    parsedParams.data.attachmentId,
  );
  response.status(204).end();
};
