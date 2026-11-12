import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { ticketAttachmentRepository } from "./attachment.repository.js";
import {
  attachmentStorage,
  attachmentStorageDriver,
} from "../../../infrastructure/storage/index.js";
import { recordAuditEvent } from "../../../shared/security/audit.js";
import { malwareScanner } from "./attachment.scanner.js";
import type { ListTicketAttachmentsQuery } from "./attachment.validators.js";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const allowedFileSignatures: Record<string, (contents: Buffer) => boolean> = {
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

const storageFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "attachment";

export const extensionMatchesContentType = (
  filename: string,
  contentType: string,
): boolean => {
  const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  return {
    "application/pdf": ["pdf"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
  }[contentType]?.includes(extension) ?? false;
};

export const ensureAttachmentDownloadable = (
  scanStatus: "pending" | "clean" | "infected",
): void => {
  if (scanStatus !== "clean") {
    throw new AppError(
      scanStatus === "pending" ? 409 : 403,
      "ATTACHMENT_NOT_AVAILABLE",
      "Attachment is not available for download",
    );
  }
};

export const makeAttachmentStorageKey = (
  organizationId: string,
  ticketId: string,
  filename: string,
): string => `org/${organizationId}/tickets/${ticketId}/${randomUUID()}-${storageFilename(filename)}`;

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
    if (!extensionMatchesContentType(file.originalname, file.mimetype)) {
      throw new AppError(
        400,
        "UNSUPPORTED_ATTACHMENT_TYPE",
        "Attachment extension does not match its MIME type",
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

    const storageKey = makeAttachmentStorageKey(
      organizationId,
      ticketId,
      file.originalname,
    );
    const checksumSha256 = createHash("sha256").update(file.buffer).digest("hex");
    await attachmentStorage.upload(storageKey, file.buffer, file.mimetype);

    try {
      const attachment = await ticketAttachmentRepository.create({
        ticketId,
        uploaderId,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        storageDriver: attachmentStorageDriver,
        scanStatus: "pending",
        checksumSha256,
      });
      if (!attachment) {
        throw new AppError(
          500,
          "ATTACHMENT_CREATION_FAILED",
          "Failed to save attachment metadata",
        );
      }

      const scanStatus = await malwareScanner.scan({
        contents: file.buffer,
        filename: file.originalname,
        contentType: file.mimetype,
      });
      const scannedAt = new Date();
      const scanned = await ticketAttachmentRepository.markScanResult(
        organizationId,
        ticketId,
        attachment.id,
        scanStatus,
        scannedAt,
      );
      if (!scanned) {
        throw new AppError(500, "ATTACHMENT_SCAN_UPDATE_FAILED", "Failed to save attachment scan result");
      }
      await recordAuditEvent({
        organizationId,
        actorUserId: uploaderId,
        eventType: "attachment_uploaded",
        resourceType: "ticket_attachment",
        resourceId: attachment.id,
        metadata: { storageDriver: attachment.storageDriver, checksumSha256 },
      });
      await recordAuditEvent({
        organizationId,
        actorUserId: uploaderId,
        eventType: "attachment_scanned",
        resourceType: "ticket_attachment",
        resourceId: attachment.id,
        metadata: { scanStatus },
      });
      return toPublicAttachment(scanned);
    } catch (error) {
      try {
        await attachmentStorage.delete(storageKey);
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
    actorUserId: string,
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
    ensureAttachmentDownloadable(attachment.scanStatus);

    try {
      const stream = await attachmentStorage.getDownloadStream(attachment.storageKey);
      await recordAuditEvent({
        organizationId,
        actorUserId,
        eventType: "attachment_downloaded",
        resourceType: "ticket_attachment",
        resourceId: attachment.id,
      });
      return {
        attachment: toPublicAttachment(attachment),
        stream,
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
    actorUserId: string,
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

    const deleted = await ticketAttachmentRepository.delete(
      attachmentId,
      attachment.ticketId,
    );
    if (!deleted) {
      throw attachmentNotFound();
    }

    try {
      await attachmentStorage.delete(attachment.storageKey);
      await recordAuditEvent({
        organizationId,
        actorUserId,
        eventType: "attachment_deleted",
        resourceType: "ticket_attachment",
        resourceId: attachment.id,
      });
    } catch (storageError) {
      await ticketAttachmentRepository.restore({
        id: attachment.id,
        ticketId: attachment.ticketId,
        uploaderId: attachment.uploaderId,
        originalFilename: attachment.originalFilename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        storageKey: attachment.storageKey,
        storageDriver: attachment.storageDriver,
        scanStatus: attachment.scanStatus,
        scannedAt: attachment.scannedAt,
        checksumSha256: attachment.checksumSha256,
      });
      throw storageError;
    }
  },
};
