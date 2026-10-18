import { randomUUID } from "node:crypto";

import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { ticketAttachmentRepository } from "./attachment.repository.js";
import { localAttachmentStorage } from "./attachment.storage.js";
import type { ListTicketAttachmentsQuery } from "./attachment.validators.js";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const allowedFileSignatures: Record<string, (contents: Buffer) => boolean> = {
  "application/pdf": (contents) =>
    contents.subarray(0, 5).toString("ascii") === "%PDF-",
  "image/png": (contents) =>
    contents.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  "image/jpeg": (contents) =>
    contents.length >= 3 &&
    contents[0] === 0xff &&
    contents[1] === 0xd8 &&
    contents[2] === 0xff,
};

const attachmentNotFound = (): AppError =>
  new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");

const ticketNotFound = (): AppError =>
  new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

const safeOriginalFilename = (filename: string): boolean =>
  filename.length > 0 &&
  filename.length <= 180 &&
  filename.trim() === filename &&
  filename !== "." &&
  filename !== ".." &&
  !/[\\/\x00-\x1f\x7f]/.test(filename) &&
  /^[\x20-\x7e]+$/.test(filename);

const toPublicAttachment = <T extends { storageKey: string }>(
  attachment: T,
) => {
  const { storageKey: _storageKey, ...publicAttachment } = attachment;
  return publicAttachment;
};

export const ticketAttachmentService = {
  async create(
    organizationId: string,
    ticketId: string,
    uploaderId: string,
    file: Express.Multer.File,
  ) {
    const ticket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );
    if (!ticket) {
      throw ticketNotFound();
    }

    if (!safeOriginalFilename(file.originalname)) {
      throw new AppError(
        400,
        "INVALID_ATTACHMENT_FILENAME",
        "Attachment filename is invalid",
      );
    }
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new AppError(
        413,
        "ATTACHMENT_TOO_LARGE",
        "Attachment must not exceed 10 MiB",
      );
    }
    const signatureValidator = allowedFileSignatures[file.mimetype];
    if (!signatureValidator || !signatureValidator(file.buffer)) {
      throw new AppError(
        400,
        "UNSUPPORTED_ATTACHMENT_TYPE",
        "Only valid PDF, PNG, and JPEG files are supported",
      );
    }

    const storageKey = randomUUID();
    await localAttachmentStorage.put(storageKey, file.buffer);

    try {
      const attachment = await ticketAttachmentRepository.create({
        ticketId,
        uploaderId,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      });
      if (!attachment) {
        throw new AppError(
          500,
          "ATTACHMENT_CREATION_FAILED",
          "Failed to save attachment metadata",
        );
      }

      return toPublicAttachment(attachment);
    } catch (error) {
      try {
        await localAttachmentStorage.delete(storageKey);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Attachment metadata creation and storage cleanup both failed",
        );
      }
      throw error;
    }
  },

  async list(
    organizationId: string,
    ticketId: string,
    query: ListTicketAttachmentsQuery,
  ) {
    const ticket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );
    if (!ticket) {
      throw ticketNotFound();
    }

    const result = await ticketAttachmentRepository.listInOrganization(
      organizationId,
      ticketId,
      query,
    );

    return {
      ...result,
      items: result.items.map(toPublicAttachment),
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  },

  async get(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
  ) {
    const attachment =
      await ticketAttachmentRepository.findByIdInOrganization(
        organizationId,
        ticketId,
        attachmentId,
      );
    if (!attachment) {
      throw attachmentNotFound();
    }

    try {
      return {
        attachment: toPublicAttachment(attachment),
        contents: await localAttachmentStorage.get(attachment.storageKey),
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new AppError(
          404,
          "ATTACHMENT_CONTENT_NOT_FOUND",
          "Attachment content is unavailable",
        );
      }
      throw error;
    }
  },

  async delete(
    organizationId: string,
    ticketId: string,
    attachmentId: string,
  ) {
    const attachment =
      await ticketAttachmentRepository.findByIdInOrganization(
        organizationId,
        ticketId,
        attachmentId,
      );
    if (!attachment) {
      throw attachmentNotFound();
    }

    await localAttachmentStorage.delete(attachment.storageKey);
    const deleted = await ticketAttachmentRepository.delete(
      attachmentId,
      attachment.ticketId,
    );
    if (!deleted) {
      throw attachmentNotFound();
    }
  },
};
