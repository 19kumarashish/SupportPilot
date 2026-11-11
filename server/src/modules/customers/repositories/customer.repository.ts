import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { customers } from "../../../db/schema/customers.js";
import { tickets } from "../../../db/schema/tickets.js";

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
  deletedAt: customers.deletedAt,
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
      .where(and(
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      ))
      .orderBy(asc(customers.createdAt))
      .limit(pagination.limit)
      .offset(offset),

    db
      .select({ count: count() })
      .from(customers)
      .where(and(
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      )),
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
        isNull(customers.deletedAt),
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
        sql`lower(${customers.email}) = lower(${email})`,
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  return customer ?? null;
}

export async function findPortalByEmail(
  organizationId: string,
  email: string,
) {
  const [customer] = await db
    .select({
      id: customers.id,
      organizationId: customers.organizationId,
      email: customers.email,
      isActive: customers.isActive,
      portalEnabled: customers.portalEnabled,
      portalPasswordHash: customers.portalPasswordHash,
    })
    .from(customers)
    .where(and(
      eq(customers.organizationId, organizationId),
      sql`lower(${customers.email}) = lower(${email})`,
      isNull(customers.deletedAt),
    ))
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
  input: UpdateCustomerInput & { portalPasswordHash?: string },
) {
  const { portalPasswordHash } =
    input;
  const fields = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.company !== undefined && { company: input.company }),
    ...(input.portalEnabled !== undefined && { portalEnabled: input.portalEnabled }),
  };
  const [customer] = await db
    .update(customers)
    .set({
      ...fields,
      ...(portalPasswordHash !== undefined && { portalPasswordHash }),
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
  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(and(
      eq(tickets.organizationId, organizationId),
      eq(tickets.customerId, customerId),
      isNull(tickets.deletedAt),
    ))
    .limit(1);
  if (ticket) return { blocked: true, customer: null } as const;

  const [customer] = await db
    .update(customers)
    .set({ deletedAt: new Date(), updatedAt: new Date(), isActive: false })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
        isNull(customers.deletedAt),
      ),
    )
    .returning(customerSelect);

  return { blocked: false, customer: customer ?? null } as const;
}