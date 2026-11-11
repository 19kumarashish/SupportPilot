import { AppError } from "../../../shared/errors/app-error.js";
import { ticketRepository } from "../repositories/ticket.repository.js";
import { ticketCommentRepository } from "./comment.repository.js";
import type {
  CreateTicketCommentInput,
  ListTicketCommentsQuery,
} from "./comment.validators.js";

const ticketNotFound = (): AppError =>
  new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

const mayViewInternalNotes = (role: string): boolean =>
  role === "admin" || role === "agent";

export const ticketCommentService = {
  async create(
    organizationId: string,
    ticketId: string,
    authorId: string,
    role: string,
    input: CreateTicketCommentInput,
  ) {
    if (input.isInternal && !mayViewInternalNotes(role)) {
      throw new AppError(
        403,
        "INSUFFICIENT_PERMISSIONS",
        "Only support staff can create internal notes",
      );
    }

    const ticket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );
    if (!ticket) {
      throw ticketNotFound();
    }

    const comment = await ticketCommentRepository.create(
      ticketId,
      authorId,
      input,
    );
    if (!comment) {
      throw new AppError(
        500,
        "TICKET_COMMENT_CREATION_FAILED",
        "Failed to create ticket comment",
      );
    }

    if (!input.isInternal) {
      await ticketRepository.markFirstRespondedInOrganization(
        organizationId,
        ticketId,
      );
    }

    return comment;
  },

  async list(
    organizationId: string,
    ticketId: string,
    role: string,
    query: ListTicketCommentsQuery,
  ) {
    const ticket = await ticketRepository.findByIdInOrganization(
      organizationId,
      ticketId,
    );
    if (!ticket) {
      throw ticketNotFound();
    }

    const result = await ticketCommentRepository.listInOrganization(
      organizationId,
      ticketId,
      query,
      mayViewInternalNotes(role),
    );

    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  },

  async update(
    organizationId: string,
    ticketId: string,
    commentId: string,
    actorUserId: string,
    actorRole: string,
    body: string,
  ) {
    const comment = await ticketCommentRepository.findInOrganization(
      organizationId, ticketId, commentId,
    );
    if (!comment) throw new AppError(404, "TICKET_COMMENT_NOT_FOUND", "Ticket comment not found");
    if (comment.authorId !== actorUserId && actorRole !== "admin") {
      throw new AppError(403, "INSUFFICIENT_PERMISSIONS", "Only the comment author or an administrator may edit this comment");
    }
    return ticketCommentRepository.update(commentId, organizationId, ticketId, actorUserId, body);
  },

  async delete(
    organizationId: string,
    ticketId: string,
    commentId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const comment = await ticketCommentRepository.findInOrganization(
      organizationId, ticketId, commentId,
    );
    if (!comment) throw new AppError(404, "TICKET_COMMENT_NOT_FOUND", "Ticket comment not found");
    if (comment.authorId !== actorUserId && actorRole !== "admin") {
      throw new AppError(403, "INSUFFICIENT_PERMISSIONS", "Only the comment author or an administrator may delete this comment");
    }
    return ticketCommentRepository.softDelete(commentId, organizationId, ticketId, actorUserId);
  },
};
