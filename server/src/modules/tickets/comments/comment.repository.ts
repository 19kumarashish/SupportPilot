import { and, asc, count, eq, isNull } from "drizzle-orm";

import { ticketComments } from "../../../db/schema/ticket-comments.js";
import { ticketActivities } from "../../../db/schema/ticket-activities.js";
import { tickets } from "../../../db/schema/tickets.js";
import { db } from "../../../infrastructure/database/index.js";
import type {
  CreateTicketCommentInput,
  ListTicketCommentsQuery,
} from "./comment.validators.js";

const commentSelect = {
  id: ticketComments.id,
  ticketId: ticketComments.ticketId,
  authorId: ticketComments.authorId,
  customerAuthorId: ticketComments.customerAuthorId,
  body: ticketComments.body,
  isInternal: ticketComments.isInternal,
  updatedAt: ticketComments.updatedAt,
  editedBy: ticketComments.editedBy,
  deletedAt: ticketComments.deletedAt,
  deletedBy: ticketComments.deletedBy,
  createdAt: ticketComments.createdAt,
};

export const ticketCommentRepository = {
  async create(ticketId: string, authorId: string, input: CreateTicketCommentInput) {
    const [comment] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        authorId,
        body: input.body,
        isInternal: input.isInternal,
      })
      .returning(commentSelect);

    return comment ?? null;
  },

  async createForCustomer(ticketId: string, customerId: string, body: string) {
    const [comment] = await db.insert(ticketComments).values({
      ticketId,
      customerAuthorId: customerId,
      body,
      isInternal: false,
    }).returning(commentSelect);
    return comment ?? null;
  },

  async listInOrganization(
    organizationId: string,
    ticketId: string,
    query: ListTicketCommentsQuery,
    includeInternal: boolean,
  ) {
    const conditions = and(
      eq(ticketComments.ticketId, ticketId),
      eq(tickets.organizationId, organizationId),
      includeInternal ? undefined : eq(ticketComments.isInternal, false),
      isNull(ticketComments.deletedAt),
    );
    const offset = (query.page - 1) * query.limit;
    const [items, totalResult] = await Promise.all([
      db
        .select(commentSelect)
        .from(ticketComments)
        .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
        .where(conditions)
        .orderBy(asc(ticketComments.createdAt), asc(ticketComments.id))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(ticketComments)
        .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
        .where(conditions),
    ]);

    return { items, total: Number(totalResult[0]?.count ?? 0) };
  },

  async findInOrganization(organizationId: string, ticketId: string, commentId: string) {
    const [comment] = await db
      .select(commentSelect)
      .from(ticketComments)
      .innerJoin(tickets, eq(ticketComments.ticketId, tickets.id))
      .where(and(
        eq(ticketComments.ticketId, ticketId),
        eq(ticketComments.id, commentId),
        eq(tickets.organizationId, organizationId),
        isNull(ticketComments.deletedAt),
      ))
      .limit(1);
    return comment ?? null;
  },

  async update(commentId: string, organizationId: string, ticketId: string, actorUserId: string, body: string) {
    return db.transaction(async (transaction) => {
      const [comment] = await transaction.update(ticketComments).set({
      body,
      editedBy: actorUserId,
      updatedAt: new Date(),
      }).where(and(
      eq(ticketComments.id, commentId),
      isNull(ticketComments.deletedAt),
      )).returning(commentSelect);
      if (!comment) return null;
      await transaction.insert(ticketActivities).values({
        organizationId, ticketId, actorUserId, action: "comment_edited",
        metadata: { commentId },
      });
      return comment;
    });
  },

  async softDelete(commentId: string, organizationId: string, ticketId: string, actorUserId: string) {
    return db.transaction(async (transaction) => {
      const [comment] = await transaction.update(ticketComments).set({
      deletedAt: new Date(),
      deletedBy: actorUserId,
      }).where(and(
      eq(ticketComments.id, commentId),
      isNull(ticketComments.deletedAt),
      )).returning(commentSelect);
      if (!comment) return null;
      await transaction.insert(ticketActivities).values({
        organizationId, ticketId, actorUserId, action: "comment_deleted",
        metadata: { commentId },
      });
      return comment;
    });
  },
};
