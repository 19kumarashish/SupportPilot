import { AppError } from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/security/password.js";
import { userRepository } from "../repositories/user.repository.js";
import type { RegisterInput } from "../validators/auth.validators.js";

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
};