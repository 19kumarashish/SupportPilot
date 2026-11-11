import type { ErrorRequestHandler, Request } from "express";
import { AppError } from "../shared/errors/app-error.js";
import { logger } from "../infrastructure/logger/index.js";

interface SafeErrorMetadata {
  category: "database_error" | "unhandled_error";
  postgresCode?: string;
  constraint?: string;
}

const safeErrorMetadata = (error: unknown): SafeErrorMetadata => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    if (
      "code" in current &&
      typeof current.code === "string" &&
      /^[0-9A-Z]{5}$/.test(current.code)
    ) {
      const metadata: SafeErrorMetadata = {
        category: "database_error",
        postgresCode: current.code,
      };
      if (
        current.code === "23505" &&
        "constraint" in current &&
        typeof current.constraint === "string" &&
        /^[a-z][a-z0-9_]{0,62}$/.test(current.constraint)
      ) {
        metadata.constraint = current.constraint;
      }
      return metadata;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return { category: "unhandled_error" };
};

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });

    return;
  }

  const requestId = (request as Request & { id?: unknown }).id;
  const safeRequestId =
    (typeof requestId === "string" &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
      ? requestId
      : typeof requestId === "number" &&
          Number.isSafeInteger(requestId) &&
          requestId >= 0
        ? String(requestId)
        : undefined);
  logger.error(
    {
      ...safeErrorMetadata(error),
      requestId: safeRequestId,
    },
    "Request failed",
  );

  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
};