import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import {
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
ticketRouter.patch("/:id/status", updateTicketStatus);
ticketRouter.patch("/:id", updateTicket);
