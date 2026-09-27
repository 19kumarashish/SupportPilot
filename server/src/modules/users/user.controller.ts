import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { userService } from "./services/user.service.js";
import {
  createUserSchema,
  paginationQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
  userStatusSchema,
} from "./validators/user.validators.js";

const validationError = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid user data");

export const listUsers: RequestHandler = async (request, response, next) => {
  try {
    const parsed = paginationQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      throw validationError();
    }

    const { organizationId } = getTenantContext(request);
    const users = await userService.listUsers(organizationId, parsed.data);

    response.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser: RequestHandler = async (request, response, next) => {
  try {
    const params = userIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw validationError();
    }

    const { organizationId } = getTenantContext(request);
    const user = await userService.getUser(organizationId, params.data.id);

    response.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const createUser: RequestHandler = async (request, response, next) => {
  try {
    const parsed = createUserSchema.safeParse(request.body);

    if (!parsed.success) {
      throw validationError();
    }

    const { organizationId } = getTenantContext(request);
    const user = await userService.createUser(organizationId, parsed.data);

    response.status(201).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (request, response, next) => {
  try {
    const params = userIdParamsSchema.safeParse(request.params);
    const body = updateUserSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      throw validationError();
    }

    const { organizationId } = getTenantContext(request);
    const user = await userService.updateUser(
      organizationId,
      params.data.id,
      body.data,
    );

    response.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const params = userIdParamsSchema.safeParse(request.params);
    const body = userStatusSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      throw validationError();
    }

    const { organizationId } = getTenantContext(request);
    const user = await userService.updateUserStatus(
      organizationId,
      params.data.id,
      body.data,
    );

    response.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (request, response, next) => {
  try {
    const params = userIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw validationError();
    }

    const { organizationId, userId } = getTenantContext(request);
    await userService.deleteUser(organizationId, params.data.id, userId);

    response.status(200).json({
      success: true,
      data: { message: "User deleted successfully" },
    });
  } catch (error) {
    next(error);
  }
};