import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { authService } from "./services/auth.service.js";
import type { AuthenticatedRequest } from "./types/auth-request.types.js";
import {
  loginSchema,
  refreshTokenSchema,
} from "./validators/auth.validators.js";

export const login: RequestHandler = async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid login data",
      );
    }

    const result = await authService.loginUser(parsed.data);

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsed = refreshTokenSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid refresh token data",
      );
    }

    const tokens = await authService.refreshTokens(
      parsed.data.refreshToken,
    );

    response.status(200).json({
      success: true,
      data: {
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const authenticatedRequest =
      request as AuthenticatedRequest;

    await authService.logoutUser(authenticatedRequest.user.id);

    response.status(200).json({
      success: true,
      data: {
        message: "Logged out successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};