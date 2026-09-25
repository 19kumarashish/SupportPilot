import { AppError } from "../../../shared/errors/app-error.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../../shared/security/jwt.js";
import {
  hashPassword,
  verifyPassword,
} from "../../../shared/security/password.js";
import { hashToken } from "../../../shared/security/token.js";
import { refreshSessionRepository } from "../repositories/refresh-session.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import type {
  LoginInput,
  RegisterInput,
} from "../validators/auth.validators.js";

export const authService = {
  async registerUser(input: RegisterInput) {
    const existingUser = await userRepository.findByEmail(
      input.organizationId,
      input.email,
    );

    if (existingUser) {
      throw new AppError(
        409,
        "USER_ALREADY_EXISTS",
        "A user with this email already exists",
      );
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      organizationId: input.organizationId,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "agent",
      isActive: true,
    });

    if (!user) {
      throw new AppError(
        500,
        "USER_CREATION_FAILED",
        "Failed to create user",
      );
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };
  },

  async loginUser(input: LoginInput) {
    const user = await userRepository.findByEmail(
      input.organizationId,
      input.email,
    );

    if (!user) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }

    if (!user.isActive) {
      throw new AppError(
        403,
        "USER_INACTIVE",
        "User account is inactive",
      );
    }

    const passwordValid = await verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }

    const accessToken = await generateAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      type: "access",
    });

    const refreshToken = await generateRefreshToken({
      userId: user.id,
      organizationId: user.organizationId,
      type: "refresh",
    });

    const refreshTokenHash = hashToken(refreshToken);

    const refreshTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await refreshSessionRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  },

  async refreshTokens(refreshToken: string) {
    let payload;

    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "Invalid or expired refresh token",
      );
    }

    if (payload.type !== "refresh") {
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "Invalid or expired refresh token",
      );
    }

    const refreshTokenHash = hashToken(refreshToken);
    const refreshSession =
      await refreshSessionRepository.findActiveByTokenHash(
        refreshTokenHash,
      );

    if (!refreshSession) {
      throw new AppError(
        401,
        "REFRESH_SESSION_NOT_FOUND",
        "Refresh session not found",
      );
    }

    if (refreshSession.expiresAt.getTime() <= Date.now()) {
      await refreshSessionRepository.revokeById(refreshSession.id);
      throw new AppError(
        401,
        "REFRESH_TOKEN_EXPIRED",
        "Refresh token expired",
      );
    }

    const user = await userRepository.findById(payload.userId);

    if (!user) {
      await refreshSessionRepository.revokeById(refreshSession.id);
      throw new AppError(401, "USER_NOT_FOUND", "User not found");
    }

    if (!user.isActive) {
      await refreshSessionRepository.revokeById(refreshSession.id);
      throw new AppError(
        403,
        "USER_INACTIVE",
        "User account is inactive",
      );
    }

    if (user.organizationId !== payload.organizationId) {
      await refreshSessionRepository.revokeById(refreshSession.id);
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "Invalid or expired refresh token",
      );
    }

    await refreshSessionRepository.revokeById(refreshSession.id);

    const newAccessToken = await generateAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      type: "access",
    });

    const newRefreshToken = await generateRefreshToken({
      userId: user.id,
      organizationId: user.organizationId,
      type: "refresh",
    });

    await refreshSessionRepository.create({
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  async logoutUser(userId: string) {
    await refreshSessionRepository.revokeAllForUser(userId);
  },
};