
import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  assignTicket,
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  updateTicketStatus,
  setTicketArchive,
  setTicketDeleted,
  bulkTicketAction,
  getTicketActivity,
} from "./ticket.controller.js";
import {
  createTicketComment,
  listTicketComments,
} from "./comments/comment.controller.js";
import {
  deleteTicketAttachment,
  downloadTicketAttachment,
  listTicketAttachments,
  authorizeAttachmentTicket,
  uploadTicketAttachment,
} from "./attachments/attachment.controller.js";
import { parseTicketAttachmentUpload } from "./attachments/attachment.upload.js";
import { updateTicketComment, deleteTicketComment } from "./comments/comment.controller.js";
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listTags, createTag, updateTag, deleteTag, replaceTicketTags,
  addTicketRelation,
  listTicketRelations, removeTicketRelation,
} from "./ticket-management.controller.js";

export const ticketRouter: Router = Router();

ticketRouter.use(requireAuth);

ticketRouter.get("/categories", listCategories);
ticketRouter.post("/categories", requireRole("admin"), createCategory);
ticketRouter.patch("/categories/:id", requireRole("admin"), updateCategory);
ticketRouter.delete("/categories/:id", requireRole("admin"), deleteCategory);
ticketRouter.get("/tags", listTags);
ticketRouter.post("/tags", requireRole("admin"), createTag);
ticketRouter.patch("/tags/:id", requireRole("admin"), updateTag);
ticketRouter.delete("/tags/:id", requireRole("admin"), deleteTag);
ticketRouter.post("/bulk-actions", requireRole("admin"), bulkTicketAction);

ticketRouter.patch("/:id/tags", requireRole("admin", "agent"), replaceTicketTags);
ticketRouter.post("/:id/relations", requireRole("admin", "agent"), addTicketRelation);
ticketRouter.get("/:id/relations", listTicketRelations);
ticketRouter.delete("/:id/relations/:relationId", requireRole("admin", "agent"), removeTicketRelation);
ticketRouter.get("/:id/activity", getTicketActivity);
ticketRouter.get("/:id/comments", listTicketComments);
ticketRouter.post("/:id/comments", createTicketComment);
ticketRouter.patch("/:id/comments/:commentId", updateTicketComment);
ticketRouter.delete("/:id/comments/:commentId", deleteTicketComment);
ticketRouter.patch("/:id/archive", requireRole("admin"), setTicketArchive);
ticketRouter.patch("/:id/delete", requireRole("admin"), setTicketDeleted);
ticketRouter.get("/:id/attachments", listTicketAttachments);
ticketRouter.post(
  "/:id/attachments",
  authorizeAttachmentTicket,
  parseTicketAttachmentUpload,
  uploadTicketAttachment,
);
ticketRouter.get(
  "/:id/attachments/:attachmentId/download",
  downloadTicketAttachment,
);
ticketRouter.delete(
  "/:id/attachments/:attachmentId",
  requireRole("admin"),
  deleteTicketAttachment,
);
ticketRouter.get("/", listTickets);
ticketRouter.get("/:id", getTicket);
ticketRouter.post("/", createTicket);
ticketRouter.patch("/:id/assignment", requireRole("admin"), assignTicket);
ticketRouter.patch("/:id/status", updateTicketStatus);
ticketRouter.patch("/:id", updateTicket);
