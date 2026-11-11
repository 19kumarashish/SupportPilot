import * as customerRepository from "../repositories/customer.repository.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/security/password.js";

import type {
  CreateCustomerInput,
  CustomerResponse,
  CustomerStatusInput,
  PaginationQuery,
  UpdateCustomerInput,
} from "../types/customer.types.js";

function toCustomerResponse(
  customer: CustomerResponse,
): CustomerResponse {
  return customer;
}

const customerNotFound = (): AppError =>
  new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

const customerEmailExists = (): AppError =>
  new AppError(
    409,
    "CUSTOMER_EMAIL_EXISTS",
    "A customer with this email already exists",
  );

export async function listCustomers(
  organizationId: string,
  pagination: PaginationQuery,
) {
  const result = await customerRepository.listInOrganization(
    organizationId,
    pagination,
  );

  return {
    items: result.items.map(toCustomerResponse),
    page: pagination.page,
    limit: pagination.limit,
    total: result.total,
    totalPages: Math.ceil(result.total / pagination.limit),
  };
}

export async function getCustomer(
  organizationId: string,
  customerId: string,
) {
  const customer = await customerRepository.findByIdInOrganization(
    organizationId,
    customerId,
  );

  if (!customer) {
    throw customerNotFound();
  }

  return toCustomerResponse(customer);
}

export async function createCustomer(
  organizationId: string,
  input: CreateCustomerInput,
) {
  if (input.email) {
    const existingCustomer = await customerRepository.findByEmail(
      organizationId,
      input.email,
    );

    if (existingCustomer) {
      throw customerEmailExists();
    }
  }

  const customer = await customerRepository.create(
    organizationId,
    input,
  );

  if (!customer) {
    throw new AppError(
      500,
      "CUSTOMER_CREATION_FAILED",
      "Failed to create customer",
    );
  }

  return toCustomerResponse(customer);
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const existingCustomer =
    await customerRepository.findByIdInOrganization(
      organizationId,
      customerId,
    );

  if (!existingCustomer) {
      throw customerNotFound();
  }

  if (
    input.email &&
    input.email !== existingCustomer.email
  ) {
    const emailOwner = await customerRepository.findByEmail(
      organizationId,
      input.email,
    );

    if (emailOwner && emailOwner.id !== customerId) {
      throw customerEmailExists();
    }
  }

  const portalPasswordHash = input.portalPassword
    ? await hashPassword(input.portalPassword)
    : undefined;
  const customer =
    await customerRepository.updateInOrganization(
      organizationId,
      customerId,
      {
        ...input,
        portalPasswordHash,
      } as UpdateCustomerInput & { portalPasswordHash?: string },
    );

  if (!customer) {
      throw customerNotFound();
  }

  return toCustomerResponse(customer);
}

export async function updateCustomerStatus(
  organizationId: string,
  customerId: string,
  input: CustomerStatusInput,
) {
  const customer =
    await customerRepository.updateStatusInOrganization(
      organizationId,
      customerId,
      input.isActive,
    );

  if (!customer) {
      throw customerNotFound();
  }

  return toCustomerResponse(customer);
}

export async function deleteCustomer(
  organizationId: string,
  customerId: string,
) {
  const result =
    await customerRepository.deleteInOrganization(
      organizationId,
      customerId,
    );
  if (result.blocked) {
    throw new AppError(
      409,
      "CUSTOMER_HAS_TICKETS",
      "Customer cannot be deleted while ticket history exists",
    );
  }

  if (!result.customer) {
      throw customerNotFound();
  }

  return toCustomerResponse(result.customer);
}