import { and, asc, count, eq } from "drizzle-orm";

import { ticketComments } from "../../../db/schema/ticket-comments.js";
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
  body: ticketComments.body,
  isInternal: ticketComments.isInternal,
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
};
