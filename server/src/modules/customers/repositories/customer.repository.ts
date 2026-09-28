import { and, asc, count, eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { customers } from "../../../db/schema/customers.js";

import type {
  CreateCustomerInput,
  PaginationQuery,
  UpdateCustomerInput,
} from "../types/customer.types.js";

const customerSelect = {
  id: customers.id,
  organizationId: customers.organizationId,
  name: customers.name,
  email: customers.email,
  phone: customers.phone,
  company: customers.company,
  isActive: customers.isActive,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

export async function listInOrganization(
  organizationId: string,
  pagination: PaginationQuery,
) {
  const offset = (pagination.page - 1) * pagination.limit;

  const [items, totalResult] = await Promise.all([
    db
      .select(customerSelect)
      .from(customers)
      .where(eq(customers.organizationId, organizationId))
      .orderBy(asc(customers.createdAt))
      .limit(pagination.limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, organizationId)),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    items,
    total,
  };
}

export async function findByIdInOrganization(
  organizationId: string,
  customerId: string,
) {
  const [customer] = await db
    .select(customerSelect)
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .limit(1);

  return customer ?? null;
}

export async function findByEmail(
  organizationId: string,
  email: string,
) {
  const [customer] = await db
    .select(customerSelect)
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.email, email),
      ),
    )
    .limit(1);

  return customer ?? null;
}

export async function create(
  organizationId: string,
  input: CreateCustomerInput,
) {
  const [customer] = await db
    .insert(customers)
    .values({
      organizationId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      isActive: true,
    })
    .returning(customerSelect);

  return customer;
}

export async function updateInOrganization(
  organizationId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const [customer] = await db
    .update(customers)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .returning(customerSelect);

  return customer ?? null;
}

export async function updateStatusInOrganization(
  organizationId: string,
  customerId: string,
  isActive: boolean,
) {
  const [customer] = await db
    .update(customers)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .returning(customerSelect);

  return customer ?? null;
}

export async function deleteInOrganization(
  organizationId: string,
  customerId: string,
) {
  const [customer] = await db
    .delete(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    )
    .returning(customerSelect);

  return customer ?? null;
}