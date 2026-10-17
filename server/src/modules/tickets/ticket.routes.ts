
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

export const ticketRouter: Router = Router();

ticketRouter.use(requireAuth);

ticketRouter.get("/", listTickets);
ticketRouter.get("/:id", getTicket);
ticketRouter.post("/", createTicket);
ticketRouter.patch("/:id/assignment", requireRole("admin"), assignTicket);
ticketRouter.patch("/:id/status", updateTicketStatus);
ticketRouter.patch("/:id", updateTicket);
