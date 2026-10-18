
import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  assignTicket,
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  updateTicketStatus,
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

export const ticketRouter: Router = Router();

ticketRouter.use(requireAuth);

ticketRouter.get("/:id/comments", listTicketComments);
ticketRouter.post("/:id/comments", createTicketComment);
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
