import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or } from "drizzle-orm";

import { customers } from "../../../db/schema/customers.js";
import { tickets } from "../../../db/schema/tickets.js";
import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";
import { ticketActivities } from "../../../db/schema/ticket-activities.js";
import { ticketAssignmentHistory } from "../../../db/schema/ticket-assignment-history.js";
import { ticketRelations } from "../../../db/schema/ticket-relations.js";
import { ticketTagLinks } from "../../../db/schema/ticket-tag-links.js";
import { ticketTags } from "../../../db/schema/ticket-tags.js";
import { ticketCategories } from "../../../db/schema/ticket-categories.js";
import type { SlaDeadlines } from "../../sla/types/sla.types.js";
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
  assignedTeamId: tickets.assignedTeamId,
  subject: tickets.subject,
  description: tickets.description,
  status: tickets.status,
  priority: tickets.priority,
  categoryId: tickets.categoryId,
  archivedAt: tickets.archivedAt,
  deletedAt: tickets.deletedAt,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
  firstResponseDeadlineAt: tickets.firstResponseDeadlineAt,
  resolutionDeadlineAt: tickets.resolutionDeadlineAt,
  firstRespondedAt: tickets.firstRespondedAt,
  slaBreachedAt: tickets.slaBreachedAt,
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
    deadlines?: SlaDeadlines,
  ) {
    return db.transaction(async (transaction) => {
      if (input.categoryId) {
        const [category] = await transaction.select({ id: ticketCategories.id }).from(ticketCategories).where(and(
          eq(ticketCategories.id, input.categoryId),
          eq(ticketCategories.organizationId, organizationId),
          isNull(ticketCategories.deletedAt),
          eq(ticketCategories.isActive, true),
        ));
        if (!category) return null;
      }
      if (input.tagIds?.length) {
        const tags = await transaction.select({ id: ticketTags.id }).from(ticketTags).where(and(
          eq(ticketTags.organizationId, organizationId),
          inArray(ticketTags.id, input.tagIds),
          isNull(ticketTags.deletedAt),
        ));
        if (new Set(tags.map((tag) => tag.id)).size !== new Set(input.tagIds).size) return null;
      }
      const [ticket] = await transaction.insert(tickets).values({
        organizationId,
        customerId: input.customerId,
        subject: input.subject,
        description: input.description,
        status: input.status,
        priority: input.priority,
        firstResponseDeadlineAt: deadlines?.firstResponseDeadlineAt,
        resolutionDeadlineAt: deadlines?.resolutionDeadlineAt,
        categoryId: input.categoryId ?? null,
        assignedTeamId: input.assignedTeamId ?? null,
      })
      .returning(ticketSelect);
      if (!ticket) return null;
      if (input.tagIds?.length) {
        await transaction.insert(ticketTagLinks).values([...new Set(input.tagIds)].map((tagId) => ({ ticketId: ticket.id, tagId })));
      }
      return ticket;
    });
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

  async listForCustomer(
    organizationId: string,
    customerId: string,
    query: ListTicketsQuery,
  ) {
    const offset = (query.page - 1) * query.limit;
    const conditions = and(
      eq(tickets.organizationId, organizationId),
      eq(tickets.customerId, customerId),
      isNull(tickets.deletedAt),
      query.status ? eq(tickets.status, query.status) : undefined,
      query.priority ? eq(tickets.priority, query.priority) : undefined,
      query.search ? or(
        ilike(tickets.subject, `%${query.search}%`),
        ilike(tickets.description, `%${query.search}%`),
      ) : undefined,
    );
    const [items, totalResult] = await Promise.all([
      db.select(ticketSelect).from(tickets).where(conditions)
        .orderBy(desc(tickets.createdAt), desc(tickets.id)).limit(query.limit).offset(offset),
      db.select({ count: count() }).from(tickets).where(conditions),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  },

  async findForCustomer(
    organizationId: string,
    customerId: string,
    ticketId: string,
  ) {
    const [ticket] = await db.select(ticketSelect).from(tickets).where(and(
      eq(tickets.organizationId, organizationId),
      eq(tickets.customerId, customerId),
      eq(tickets.id, ticketId),
      isNull(tickets.deletedAt),
    )).limit(1);
    return ticket ?? null;
  },

  async listInOrganization(
    organizationId: string,
    query: ListTicketsQuery,
  ) {
    const offset = (query.page - 1) * query.limit;
    const conditions = [
      eq(tickets.organizationId, organizationId),
      query.includeDeleted ? undefined : isNull(tickets.deletedAt),
      query.includeArchived ? undefined : isNull(tickets.archivedAt),
      query.status ? eq(tickets.status, query.status) : undefined,
      query.priority ? eq(tickets.priority, query.priority) : undefined,
      query.customerId
        ? eq(tickets.customerId, query.customerId)
        : undefined,
      query.categoryId ? eq(tickets.categoryId, query.categoryId) : undefined,
      query.assignedTo === "unassigned"
        ? isNull(tickets.assignedTo)
        : query.assignedTo ? eq(tickets.assignedTo, query.assignedTo) : undefined,
      query.assignedTeamId ? eq(tickets.assignedTeamId, query.assignedTeamId) : undefined,
      query.search ? or(
        ilike(tickets.subject, `%${query.search}%`),
        ilike(tickets.description, `%${query.search}%`),
        ilike(tickets.id, `%${query.search}%`),
      ) : undefined,
    ];
    const sortColumn = {
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      subject: tickets.subject,
      priority: tickets.priority,
      status: tickets.status,
    }[query.sortBy];
    const order = query.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);
    let itemsQuery;
    let countQuery;
    if (query.tagId) {
      itemsQuery = db
        .select(ticketSelect)
        .from(tickets)
        .innerJoin(ticketTagLinks, and(
          eq(ticketTagLinks.ticketId, tickets.id),
          eq(ticketTagLinks.tagId, query.tagId),
        ))
        .where(and(...conditions));
      countQuery = db
        .select({ count: count() })
        .from(tickets)
        .innerJoin(ticketTagLinks, and(
          eq(ticketTagLinks.ticketId, tickets.id),
          eq(ticketTagLinks.tagId, query.tagId),
        ))
        .where(and(...conditions));
    } else {
      itemsQuery = db.select(ticketSelect).from(tickets).where(and(...conditions));
      countQuery = db.select({ count: count() }).from(tickets).where(and(...conditions));
    }
    const [items, totalResult] = await Promise.all([
      itemsQuery.orderBy(order, desc(tickets.id)).limit(query.limit).offset(offset),
      countQuery,
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
    deadlines?: SlaDeadlines,
  ) {
    return db.transaction(async (transaction) => {
      if (input.categoryId) {
        const [category] = await transaction.select({ id: ticketCategories.id }).from(ticketCategories).where(and(
          eq(ticketCategories.id, input.categoryId),
          eq(ticketCategories.organizationId, organizationId),
          isNull(ticketCategories.deletedAt),
          eq(ticketCategories.isActive, true),
        ));
        if (!category) return null;
      }
      const [ticket] = await transaction
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
        ...(deadlines && {
          firstResponseDeadlineAt: deadlines.firstResponseDeadlineAt,
          resolutionDeadlineAt: deadlines.resolutionDeadlineAt,
          slaBreachedAt: null,
        }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.assignedTeamId !== undefined && { assignedTeamId: input.assignedTeamId }),
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

  async markFirstRespondedInOrganization(
    organizationId: string,
    ticketId: string,
    respondedAt = new Date(),
  ) {
    const [ticket] = await db.update(tickets).set({
      firstRespondedAt: respondedAt,
      updatedAt: respondedAt,
    }).where(and(
      eq(tickets.organizationId, organizationId),
      eq(tickets.id, ticketId),
      isNull(tickets.firstRespondedAt),
    )).returning(ticketSelect);
    return ticket ?? null;
  },

  async findTicketsDueForBreach(now = new Date()) {
    return db.select({
      id: tickets.id,
      organizationId: tickets.organizationId,
      subject: tickets.subject,
      resolutionDeadlineAt: tickets.resolutionDeadlineAt,
      customerEmail: customers.email,
    }).from(tickets)
      .innerJoin(customers, eq(customers.id, tickets.customerId))
      .where(and(
        inArray(tickets.status, ["open", "in_progress"]),
        isNull(tickets.slaBreachedAt),
        lte(tickets.resolutionDeadlineAt, now),
        isNull(tickets.deletedAt),
      ));
  },

  async markSlaBreached(
    organizationId: string,
    ticketId: string,
    breachedAt = new Date(),
  ) {
    const [ticket] = await db.update(tickets).set({
      slaBreachedAt: breachedAt,
      updatedAt: breachedAt,
    }).where(and(
      eq(tickets.organizationId, organizationId),
      eq(tickets.id, ticketId),
      inArray(tickets.status, ["open", "in_progress"]),
      isNull(tickets.slaBreachedAt),
      lte(tickets.resolutionDeadlineAt, breachedAt),
    )).returning(ticketSelect);
    return ticket ?? null;
  },

  async updateAssignmentInOrganization(
    organizationId: string,
    ticketId: string,
    assignedTo: string | null,
    actorUserId?: string,
  ) {
    if (assignedTo === null) {
      return db.transaction(async (transaction) => {
        const [existing] = await transaction.select({ assignedTo: tickets.assignedTo }).from(tickets).where(and(
          eq(tickets.id, ticketId), eq(tickets.organizationId, organizationId),
        ));
        if (!existing) return null;
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
        if (!ticket) return null;
        await transaction.insert(ticketAssignmentHistory).values({
          ticketId, assignedFrom: existing.assignedTo, assignedTo: null,
          actorUserId: actorUserId ?? null,
        });
        await transaction.insert(ticketActivities).values({
          organizationId, ticketId, actorUserId: actorUserId ?? null,
          action: "assignment_changed", before: { assignedTo: existing.assignedTo }, after: { assignedTo: null },
        });
        return ticket;
      });
    }

    return db.transaction(async (transaction) => {
      const [existing] = await transaction.select({ assignedTo: tickets.assignedTo }).from(tickets).where(and(
        eq(tickets.id, ticketId), eq(tickets.organizationId, organizationId),
      ));
      if (!existing) return null;
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
      if (!ticket) return null;
      await transaction.insert(ticketAssignmentHistory).values({
        ticketId, assignedFrom: existing.assignedTo,
        assignedTo, actorUserId: actorUserId ?? null,
      });
      await transaction.insert(ticketActivities).values({
        organizationId, ticketId, actorUserId: actorUserId ?? null,
        action: "assignment_changed", before: { assignedTo: existing.assignedTo }, after: { assignedTo },
      });
      return ticket;
    });
  },

  async updateStatusInOrganization(
    organizationId: string,
    ticketId: string,
    status: Ticket["status"],
    actorUserId?: string,
  ) {
    return db.transaction(async (transaction) => {
      const [existing] = await transaction.select({ status: tickets.status }).from(tickets).where(and(
        eq(tickets.id, ticketId), eq(tickets.organizationId, organizationId),
      ));
      if (!existing) return null;
      const [ticket] = await transaction
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
      if (!ticket) return null;
      await transaction.insert(ticketActivities).values({
        organizationId, ticketId, actorUserId: actorUserId ?? null,
        action: "status_changed", before: { status: existing.status }, after: { status },
      });
      return ticket;
    });
  },

  async setArchiveInOrganization(
    organizationId: string,
    ticketId: string,
    archived: boolean,
    actorUserId: string,
  ) {
    return db.transaction(async (transaction) => {
      const [ticket] = await transaction
        .update(tickets)
        .set({
          archivedAt: archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(tickets.organizationId, organizationId),
          eq(tickets.id, ticketId),
          isNull(tickets.deletedAt),
        ))
        .returning(ticketSelect);
      if (!ticket) return null;
      await transaction.insert(ticketActivities).values({
        organizationId,
        ticketId,
        actorUserId,
        action: archived ? "archived" : "restored",
        before: { archivedAt: null },
        after: { archivedAt: ticket.archivedAt },
      });
      return ticket;
    });
  },

  async setDeletedInOrganization(
    organizationId: string,
    ticketId: string,
    actorUserId: string,
    deleted: boolean,
  ) {
    return db.transaction(async (transaction) => {
      const [ticket] = await transaction
        .update(tickets)
        .set({
          deletedAt: deleted ? new Date() : null,
          archivedAt: deleted ? null : null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(tickets.organizationId, organizationId),
          eq(tickets.id, ticketId),
        ))
        .returning(ticketSelect);
      if (!ticket) return null;
      await transaction.insert(ticketActivities).values({
        organizationId,
        ticketId,
        actorUserId,
        action: deleted ? "deleted" : "restored",
        metadata: { deleted },
      });
      return ticket;
    });
  },

  async activityInOrganization(organizationId: string, ticketId: string) {
    const result = await db
      .select()
      .from(ticketActivities)
      .where(and(
        eq(ticketActivities.organizationId, organizationId),
        eq(ticketActivities.ticketId, ticketId),
      ))
      .orderBy(desc(ticketActivities.createdAt));
    return result;
  },

  async assignmentHistoryInOrganization(organizationId: string, ticketId: string) {
    const result = await db
      .select()
      .from(ticketAssignmentHistory)
      .innerJoin(tickets, eq(ticketAssignmentHistory.ticketId, tickets.id))
      .where(and(
        eq(tickets.organizationId, organizationId),
        eq(ticketAssignmentHistory.ticketId, ticketId),
      ))
      .orderBy(desc(ticketAssignmentHistory.createdAt));
    return result.map((row) => row.ticket_assignment_history);
  },

  async addRelationInOrganization(
    organizationId: string,
    ticketId: string,
    relatedTicketId: string,
    relationType: (typeof ticketRelations.$inferInsert)["relationType"],
  ) {
    if (ticketId === relatedTicketId) return null;
    return db.transaction(async (transaction) => {
      const ticketsInScope = await transaction
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(
          eq(tickets.organizationId, organizationId),
          inArray(tickets.id, [ticketId, relatedTicketId]),
        ));
      if (ticketsInScope.length !== 2) return null;
      const [relation] = await transaction
        .insert(ticketRelations)
        .values({ ticketId, relatedTicketId, relationType })
        .onConflictDoNothing()
        .returning();
      return relation ?? null;
    });
  },

  async removeRelationInOrganization(
    organizationId: string,
    ticketId: string,
    relationId: string,
  ) {
    const [relation] = await db
      .delete(ticketRelations)
      .where(and(
        eq(ticketRelations.id, relationId),
        eq(ticketRelations.ticketId, ticketId),
      ))
      .returning();
    if (!relation) return null;
    const [ticket] = await db.select({ id: tickets.id }).from(tickets).where(and(
      eq(tickets.id, ticketId),
      eq(tickets.organizationId, organizationId),
    ));
    return ticket ? relation : null;
  },

  async bulkActionInOrganization(
    organizationId: string,
    actorUserId: string,
    ticketIds: string[],
    action: "assign" | "unassign" | "status" | "priority" | "archive" | "restore" | "delete",
    value?: { assignedTo?: string | null; status?: Ticket["status"]; priority?: Ticket["priority"] },
  ) {
    return db.transaction(async (transaction) => {
      const scoped = await transaction.select({ id: tickets.id, status: tickets.status }).from(tickets).where(and(
        eq(tickets.organizationId, organizationId),
        inArray(tickets.id, ticketIds),
      ));
      if (scoped.length !== ticketIds.length) return { success: false, updated: 0 } as const;
      if (action === "assign" && value?.assignedTo) {
        const [assignee] = await transaction.select({ id: users.id }).from(users).where(and(
          eq(users.id, value.assignedTo),
          eq(users.organizationId, organizationId),
          eq(users.role, "agent"),
          eq(users.isActive, true),
        ));
        if (!assignee) return { success: false, updated: 0 } as const;
      }
      let setValue: Partial<typeof tickets.$inferInsert> = { updatedAt: new Date() };
      if (action === "assign") setValue.assignedTo = value?.assignedTo ?? null;
      if (action === "unassign") setValue.assignedTo = null;
      if (action === "status" && value?.status) setValue.status = value.status;
      if (action === "priority" && value?.priority) setValue.priority = value.priority;
      if (action === "archive") setValue.archivedAt = new Date();
      if (action === "restore") setValue = { archivedAt: null, deletedAt: null, updatedAt: new Date() };
      if (action === "delete") setValue = { deletedAt: new Date(), updatedAt: new Date() };
      const updated = await transaction.update(tickets).set(setValue).where(and(
        eq(tickets.organizationId, organizationId),
        inArray(tickets.id, ticketIds),
      )).returning({ id: tickets.id });
      await transaction.insert(ticketActivities).values(updated.map((ticket) => ({
        organizationId,
        ticketId: ticket.id,
        actorUserId,
        action: `bulk_${action}`,
        metadata: value ?? {},
      })));
      return { success: true, updated: updated.length } as const;
    });
  },
};
