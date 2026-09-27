import type { users } from "../../../infrastructure/database/schema/users.js";

export type UserRole = typeof users.$inferSelect.role;

export interface UserResponse {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserInput {
  email?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role?: UserRole | undefined;
}

export interface UserStatusInput {
  isActive: boolean;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedUserResponse {
  users: UserResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}