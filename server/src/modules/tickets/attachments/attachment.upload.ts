import multer, { MulterError } from "multer";
import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./attachment.service.js";

const uploadSingleAttachment = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter(_request, file, callback) {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype)) {
      callback(
        new AppError(
          400,
          "UNSUPPORTED_ATTACHMENT_TYPE",
          "Only PDF, PNG, and JPEG files are supported",
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single("file");

export const parseTicketAttachmentUpload: RequestHandler = (
  request,
  response,
  next,
) => {
  uploadSingleAttachment(request, response, (error: unknown) => {
    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError(
            413,
            "ATTACHMENT_TOO_LARGE",
            "Attachment must not exceed 10 MiB",
          ),
        );
        return;
      }

      next(
        new AppError(
          400,
          "INVALID_ATTACHMENT_UPLOAD",
          "Upload one file using the file form field",
        ),
      );
      return;
    }

    next(error);
  });
};
