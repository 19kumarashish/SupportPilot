import { asc, count, desc, eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";
import { userRepository as authUserRepository } from "../../auth/repositories/user.repository.js";
import type { PaginationQuery, UpdateUserInput } from "../types/user.types.js";

type UserUpdateData = Partial<
  Pick<typeof users.$inferInsert, "email" | "firstName" | "lastName" | "role" | "isActive">
>;

export const userRepository = {
  async listInOrganization(organizationId: string, pagination: PaginationQuery) {
    const offset = (pagination.page - 1) * pagination.limit;
    const [userRows, countRows] = await Promise.all([
      db
        .select({
          id: users.id,
          organizationId: users.organizationId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .orderBy(desc(users.createdAt), asc(users.id))
        .limit(pagination.limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(users)
        .where(eq(users.organizationId, organizationId)),
    ]);

    return {
      users: userRows,
      total: countRows[0]?.total ?? 0,
    };
  },

  findByIdInOrganization(organizationId: string, userId: string) {
    return authUserRepository.findByIdInOrganization(organizationId, userId);
  },

  findByEmail(organizationId: string, email: string) {
    return authUserRepository.findByEmail(organizationId, email);
  },

  create(data: typeof users.$inferInsert) {
    return authUserRepository.create(data);
  },

  updateInOrganization(
    organizationId: string,
    userId: string,
    data: UpdateUserInput | { isActive: boolean },
  ) {
    const updateData: UserUpdateData = {};

    if ("email" in data && data.email !== undefined) {
      updateData.email = data.email;
    }
    if ("firstName" in data && data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }
    if ("lastName" in data && data.lastName !== undefined) {
      updateData.lastName = data.lastName;
    }
    if ("role" in data && data.role !== undefined) {
      updateData.role = data.role;
    }
    if ("isActive" in data) {
      updateData.isActive = data.isActive;
    }

    return authUserRepository.updateInOrganization(
      organizationId,
      userId,
      updateData,
    );
  },

  deleteInOrganization(organizationId: string, userId: string) {
    return authUserRepository.deleteInOrganization(organizationId, userId);
  },
};