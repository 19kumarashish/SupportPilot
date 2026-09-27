import { AppError } from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/security/password.js";
import { userRepository } from "../repositories/user.repository.js";
import type {
  CreateUserInput,
  PaginatedUserResponse,
  PaginationQuery,
  UpdateUserInput,
  UserResponse,
  UserStatusInput,
} from "../types/user.types.js";

const toUserResponse = (user: UserResponse): UserResponse => ({
  id: user.id,
  organizationId: user.organizationId,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const userNotFound = (): AppError =>
  new AppError(404, "USER_NOT_FOUND", "User not found");

const userAlreadyExists = (): AppError =>
  new AppError(
    409,
    "USER_ALREADY_EXISTS",
    "A user with this email already exists",
  );

const isOrganizationEmailConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505" &&
  "constraint" in error &&
  error.constraint === "users_organization_email_unique";

export const userService = {
  async listUsers(
    organizationId: string,
    pagination: PaginationQuery,
  ): Promise<PaginatedUserResponse> {
    const result = await userRepository.listInOrganization(
      organizationId,
      pagination,
    );

    return {
      users: result.users.map(toUserResponse),
      pagination: {
        ...pagination,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    };
  },

  async getUser(organizationId: string, userId: string): Promise<UserResponse> {
    const user = await userRepository.findByIdInOrganization(
      organizationId,
      userId,
    );

    if (!user) {
      throw userNotFound();
    }

    return toUserResponse(user);
  },

  async createUser(
    organizationId: string,
    input: CreateUserInput,
  ): Promise<UserResponse> {
    if (await userRepository.findByEmail(organizationId, input.email)) {
      throw userAlreadyExists();
    }

    const passwordHash = await hashPassword(input.password);

    try {
      const user = await userRepository.create({
        organizationId,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        isActive: true,
      });

      if (!user) {
        throw new AppError(
          500,
          "USER_CREATION_FAILED",
          "Failed to create user",
        );
      }

      return toUserResponse(user);
    } catch (error) {
      if (isOrganizationEmailConflict(error)) {
        throw userAlreadyExists();
      }

      throw error;
    }
  },

  async updateUser(
    organizationId: string,
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserResponse> {
    const existingUser = await userRepository.findByIdInOrganization(
      organizationId,
      userId,
    );

    if (!existingUser) {
      throw userNotFound();
    }

    if (
      input.email &&
      input.email !== existingUser.email &&
      await userRepository.findByEmail(organizationId, input.email)
    ) {
      throw userAlreadyExists();
    }

    try {
      const user = await userRepository.updateInOrganization(
        organizationId,
        userId,
        input,
      );

      if (!user) {
        throw userNotFound();
      }

      return toUserResponse(user);
    } catch (error) {
      if (isOrganizationEmailConflict(error)) {
        throw userAlreadyExists();
      }

      throw error;
    }
  },

  async updateUserStatus(
    organizationId: string,
    userId: string,
    input: UserStatusInput,
  ): Promise<UserResponse> {
    const user = await userRepository.updateInOrganization(
      organizationId,
      userId,
      input,
    );

    if (!user) {
      throw userNotFound();
    }

    return toUserResponse(user);
  },

  async deleteUser(
    organizationId: string,
    userId: string,
    authenticatedUserId: string,
  ): Promise<void> {
    if (userId === authenticatedUserId) {
      throw new AppError(
        400,
        "CANNOT_DELETE_SELF",
        "You cannot delete your own account",
      );
    }

    const deletedUser = await userRepository.deleteInOrganization(
      organizationId,
      userId,
    );

    if (!deletedUser) {
      throw userNotFound();
    }
  },
};