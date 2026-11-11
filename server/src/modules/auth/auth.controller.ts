import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { authService } from "./services/auth.service.js";
import { organizationSignupService } from "./services/organization-signup.service.js";
import type { AuthenticatedRequest } from "./types/auth-request.types.js";
import {
  loginSchema,
  organizationSignupSchema,
  resendOrganizationSignupVerificationSchema,
  refreshTokenSchema,
  verifyOrganizationSignupSchema,
} from "./validators/auth.validators.js";
import {
  isEmailDeliveryConfigured,
  takeDevelopmentVerificationLink,
} from "./services/email-provider.js";
import { env } from "../../config/env.js";
import { z } from "zod";
import { allowSignupVerificationResend } from "./services/signup-resend-rate-limit.js";
import { takeDevelopmentInvitationLink } from "./services/email-provider.js";

const signupVerificationResendResponse = {
  success: true,
  data: {
    message:
      "If those details match an unexpired pending signup, check your inbox for a fresh verification link. If it does not arrive, request another link later.",
  },
} as const;

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

export const beginOrganizationSignup: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsed = organizationSignupSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid organization signup data",
      );
    }

    await organizationSignupService.begin(parsed.data);

    response.status(202).json({
      success: true,
      data: {
        message: "If the signup can be completed, a verification email will be sent.",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendOrganizationSignupVerification: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsed =
      resendOrganizationSignupVerificationSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid verification resend data",
      );
    }

    if (!isEmailDeliveryConfigured()) {
      throw new AppError(
        503,
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email delivery is not configured",
      );
    }

    const remoteAddress = request.socket.remoteAddress ?? "unknown";
    if (allowSignupVerificationResend(remoteAddress)) {
      await organizationSignupService.resendVerification(parsed.data);
    }

    response.status(202).json(signupVerificationResendResponse);
  } catch (error) {
    next(error);
  }
};

export const verifyOrganizationSignup: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const parsed = verifyOrganizationSignupSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid verification token",
      );
    }

    const result = await organizationSignupService.verify(parsed.data.token);

    response.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getDevelopmentVerificationLink: RequestHandler = (
  request,
  response,
  next,
) => {
  try {
    const remoteAddress = request.socket.remoteAddress;
    const isLoopback =
      remoteAddress === "127.0.0.1" ||
      remoteAddress === "::1" ||
      remoteAddress === "::ffff:127.0.0.1";
    if (env.NODE_ENV !== "development" || !isLoopback) {
      throw new AppError(404, "NOT_FOUND", "Not found");
    }

    const parsed = z.object({ email: z.string().trim().email().max(255) })
      .strict()
      .safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "A valid signup email is required",
      );
    }

    const verificationUrl = takeDevelopmentVerificationLink(parsed.data.email);
    if (!verificationUrl) {
      throw new AppError(
        404,
        "VERIFICATION_LINK_NOT_FOUND",
        "No unexpired development verification link is available",
      );
    }

    response.status(200).json({
      success: true,
      data: { verificationUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const getDevelopmentInvitation = (request: Parameters<RequestHandler>[0], response: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]): void => {
  try {
    if (env.NODE_ENV === "production") throw new AppError(404, "NOT_FOUND", "Not found");
    const parsed = z.object({ email: z.string().email().max(255) }).safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "A valid invitation email is required");
    const invitationUrl = takeDevelopmentInvitationLink(parsed.data.email);
    if (!invitationUrl) throw new AppError(404, "INVITATION_LINK_NOT_FOUND", "No unexpired development invitation link is available");
    response.json({ success: true, data: { invitationUrl } });
  } catch (error) {
    next(error);
  }
};