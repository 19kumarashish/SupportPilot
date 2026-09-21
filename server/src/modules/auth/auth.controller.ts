import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { authService } from "./services/auth.service.js";
import { loginSchema } from "./validators/auth.validators.js";

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