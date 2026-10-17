import { and, count, desc, eq } from "drizzle-orm";

import { customers } from "../../../db/schema/customers.js";
import { tickets } from "../../../db/schema/tickets.js";
import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";
import type {
  CreateTicketInput,
  ListTicketsQuery,
  Ticket,
  UpdateTicketInput,
} from "../types/ticket.types.js";

const ticketSelect = {
  id: tickets.id,
  organizationId: tickets.organizationId,
  customerId: tickets.customerId,
  assignedTo: tickets.assignedTo,
  subject: tickets.subject,
  description: tickets.description,
  status: tickets.status,
  priority: tickets.priority,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
};

export type TicketRecord = typeof tickets.$inferSelect;

export const ticketRepository = {
  async findUserInOrganization(
    organizationId: string,
    userId: string,
  ) {
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    return user ?? null;
  },

  async findCustomerInOrganization(
    organizationId: string,
    customerId: string,
  ) {
    const [customer] = await db
      .select({ id: customers.id, isActive: customers.isActive })
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, organizationId),
        ),
      )
      .limit(1);

    return customer ?? null;
  },

  async create(
    organizationId: string,
    input: CreateTicketInput,
  ) {
    const [ticket] = await db
      .insert(tickets)
      .values({
        organizationId,
        customerId: input.customerId,
        subject: input.subject,
        description: input.description,
        status: input.status,
        priority: input.priority,
      })
      .returning(ticketSelect);

    return ticket ?? null;
  },

  async findByIdInOrganization(
    organizationId: string,
    ticketId: string,
  ) {
    const [ticket] = await db
      .select(ticketSelect)
      .from(tickets)
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.organizationId, organizationId),
        ),
      )
      .limit(1);

    return ticket ?? null;
  },

  async listInOrganization(
    organizationId: string,
    query: ListTicketsQuery,
  ) {
    const offset = (query.page - 1) * query.limit;
    const conditions = [
      eq(tickets.organizationId, organizationId),
      query.status ? eq(tickets.status, query.status) : undefined,
      query.priority ? eq(tickets.priority, query.priority) : undefined,
      query.customerId
        ? eq(tickets.customerId, query.customerId)
        : undefined,
    ];

    const [items, totalResult] = await Promise.all([
      db
        .select(ticketSelect)
        .from(tickets)
        .where(and(...conditions))
        .orderBy(desc(tickets.createdAt), desc(tickets.id))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(tickets)
        .where(and(...conditions)),
    ]);

    return {
      items,
      total: Number(totalResult[0]?.count ?? 0),
    };
  },

  async updateInOrganization(
    organizationId: string,
    ticketId: string,
    input: UpdateTicketInput,
  ) {
    const [ticket] = await db
      .update(tickets)
      .set({
        ...(input.customerId !== undefined && {
          customerId: input.customerId,
        }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.priority !== undefined && { priority: input.priority }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.organizationId, organizationId),
        ),
      )
      .returning(ticketSelect);

    return ticket ?? null;
  },

  async updateAssignmentInOrganization(
    organizationId: string,
    ticketId: string,
    assignedTo: string | null,
  ) {
    if (assignedTo === null) {
      const [ticket] = await db
        .update(tickets)
        .set({
          assignedTo,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tickets.id, ticketId),
            eq(tickets.organizationId, organizationId),
          ),
        )
        .returning(ticketSelect);

      return ticket ?? null;
    }

    return db.transaction(async (transaction) => {
      const [assignee] = await transaction
        .select({
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(
          and(
            eq(users.id, assignedTo),
            eq(users.organizationId, organizationId),
          ),
        )
        .limit(1)
        .for("update");

      if (!assignee || assignee.role !== "agent" || !assignee.isActive) {
        return null;
      }

      const [ticket] = await transaction
        .update(tickets)
        .set({
          assignedTo,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tickets.id, ticketId),
            eq(tickets.organizationId, organizationId),
          ),
        )
        .returning(ticketSelect);

      return ticket ?? null;
    });
  },

  async updateStatusInOrganization(
    organizationId: string,
    ticketId: string,
    status: Ticket["status"],
  ) {
    const [ticket] = await db
      .update(tickets)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.organizationId, organizationId),
        ),
      )
      .returning(ticketSelect);

    return ticket ?? null;
  },
};
