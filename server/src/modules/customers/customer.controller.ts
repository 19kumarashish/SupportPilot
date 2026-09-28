import type { Request, Response } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import * as customerService from "./services/customer.service.js";
import {
  createCustomerSchema,
  customerIdParamsSchema,
  customerStatusSchema,
  paginationQuerySchema,
  updateCustomerSchema,
} from "./validators/customer.validators.js";

const validationError = (): AppError =>
  new AppError(400, "VALIDATION_ERROR", "Invalid customer data");

export async function listCustomers(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedPagination = paginationQuerySchema.safeParse(request.query);

  if (!parsedPagination.success) {
    throw validationError();
  }

  const result = await customerService.listCustomers(
    organizationId,
    parsedPagination.data,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
}

export async function getCustomer(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedParams = customerIdParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    throw validationError();
  }

  const customer = await customerService.getCustomer(
    organizationId,
    parsedParams.data.id,
  );

  response.status(200).json({
    success: true,
    data: { customer },
  });
}

export async function createCustomer(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedInput = createCustomerSchema.safeParse(request.body);

  if (!parsedInput.success) {
    throw validationError();
  }

  const customer = await customerService.createCustomer(
    organizationId,
    parsedInput.data,
  );

  response.status(201).json({
    success: true,
    data: { customer },
  });
}

export async function updateCustomer(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedParams = customerIdParamsSchema.safeParse(request.params);
  const parsedInput = updateCustomerSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const customer = await customerService.updateCustomer(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
  );

  response.status(200).json({
    success: true,
    data: { customer },
  });
}

export async function updateCustomerStatus(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedParams = customerIdParamsSchema.safeParse(request.params);
  const parsedInput = customerStatusSchema.safeParse(request.body);

  if (!parsedParams.success || !parsedInput.success) {
    throw validationError();
  }

  const customer = await customerService.updateCustomerStatus(
    organizationId,
    parsedParams.data.id,
    parsedInput.data,
  );

  response.status(200).json({
    success: true,
    data: { customer },
  });
}

export async function deleteCustomer(
  request: Request,
  response: Response,
) {
  const { organizationId } = getTenantContext(request);

  const parsedParams = customerIdParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    throw validationError();
  }

  const customer = await customerService.deleteCustomer(
    organizationId,
    parsedParams.data.id,
  );

  response.status(200).json({
    success: true,
    data: { customer },
  });
}