import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { verifyAccessToken } from "../../shared/security/jwt.js";
import { userRepository } from "./repositories/user.repository.js";
import type { AuthenticatedRequest } from "./types/auth-request.types.js";
import type { AuthUser } from "./types/auth.types.js";

export const requireAuth: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication required",
      );
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(
        401,
        "INVALID_AUTHORIZATION_HEADER",
        "Invalid authorization header",
      );
    }

    const payload = await verifyAccessToken(token);

    if (payload.type !== "access") {
      throw new AppError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Invalid access token",
      );
    }

    const user = await userRepository.findById(payload.userId);

    if (!user) {
      throw new AppError(
        401,
        "USER_NOT_FOUND",
        "Authenticated user no longer exists",
      );
    }

    if (!user.isActive) {
      throw new AppError(
        403,
        "USER_INACTIVE",
        "User account is inactive",
      );
    }

    const authenticatedRequest =
      request as AuthenticatedRequest;

    authenticatedRequest.user = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(
      new AppError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Invalid or expired access token",
      ),
    );
  }
};

export const requireRole = (
  ...allowedRoles: AuthUser["role"][]
): RequestHandler => {
  return (request, _response, next) => {
    const authenticatedRequest =
      request as Partial<AuthenticatedRequest>;

    if (!authenticatedRequest.user) {
      next(
        new AppError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication required",
        ),
      );
      return;
    }

    if (!allowedRoles.includes(authenticatedRequest.user.role)) {
      next(
        new AppError(
          403,
          "INSUFFICIENT_PERMISSIONS",
          "Insufficient permissions",
        ),
      );
      return;
    }

    next();
  };
};