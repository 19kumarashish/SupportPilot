import type { Request } from "express";

import { AppError } from "./errors/app-error.js";
import type { AuthenticatedRequest } from "../modules/auth/types/auth-request.types.js";
import type { AuthUser } from "../modules/auth/types/auth.types.js";

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: AuthUser["role"];
}

export const getTenantContext = (request: Request): TenantContext => {
  const user = (
    request as Request & { user?: AuthenticatedRequest["user"] }
  ).user;

  if (
    !user ||
    typeof user.id !== "string" ||
    user.id.length === 0 ||
    typeof user.organizationId !== "string" ||
    user.organizationId.length === 0 ||
    (user.role !== "admin" && user.role !== "agent")
  ) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication required",
    );
  }

  return {
    organizationId: user.organizationId,
    userId: user.id,
    role: user.role,
  };
};