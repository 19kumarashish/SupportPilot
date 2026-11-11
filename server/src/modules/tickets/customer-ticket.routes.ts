import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../shared/errors/app-error.js";
import type { CustomerAccessRequest } from "../customers/customer-auth.js";
import { requireCustomerAuth } from "../customers/customer-auth.js";
import { ticketRepository } from "./repositories/ticket.repository.js";
import { ticketCommentRepository } from "./comments/comment.repository.js";
import { listTicketsQuerySchema } from "./validators/ticket.validators.js";

export const customerTicketRouter: Router = Router();
customerTicketRouter.use(requireCustomerAuth);

customerTicketRouter.get("/", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  if (!customer) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  const parsed = listTicketsQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid ticket query");
  const result = await ticketRepository.listForCustomer(customer.organizationId, customer.id, parsed.data);
  response.json({ success: true, data: { items: result.items, page: parsed.data.page, limit: parsed.data.limit, total: result.total, totalPages: Math.ceil(result.total / parsed.data.limit) } });
});

customerTicketRouter.get("/:id", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  const params = z.object({ id: z.uuid() }).safeParse(request.params);
  if (!customer || !params.success) throw new AppError(params.success ? 401 : 400, params.success ? "AUTHENTICATION_REQUIRED" : "VALIDATION_ERROR", params.success ? "Authentication required" : "Invalid ticket id");
  const ticket = await ticketRepository.findForCustomer(customer.organizationId, customer.id, params.data.id);
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  response.json({ success: true, data: { ticket } });
});

customerTicketRouter.post("/", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  if (!customer) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  const body = z.object({
    subject: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1).max(10000),
  }).strict().safeParse(request.body);
  if (!body.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid ticket data");
  const ticket = await ticketRepository.create(customer.organizationId, {
    customerId: customer.id,
    subject: body.data.subject,
    description: body.data.description,
    status: "open",
    priority: "medium",
  });
  if (!ticket) throw new AppError(500, "TICKET_CREATION_FAILED", "Failed to create ticket");
  response.status(201).json({ success: true, data: { ticket } });
});

customerTicketRouter.get("/:id/comments", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  const params = z.object({ id: z.uuid() }).safeParse(request.params);
  if (!customer || !params.success) throw new AppError(params.success ? 401 : 400, params.success ? "AUTHENTICATION_REQUIRED" : "VALIDATION_ERROR", params.success ? "Authentication required" : "Invalid ticket id");
  const ticket = await ticketRepository.findForCustomer(customer.organizationId, customer.id, params.data.id);
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const result = await ticketCommentRepository.listInOrganization(customer.organizationId, params.data.id, { page: 1, limit: 100 }, false);
  response.json({ success: true, data: { comments: result.items } });
});

customerTicketRouter.post("/:id/comments", async (request, response) => {
  const customer = (request as CustomerAccessRequest).customer;
  const params = z.object({ id: z.uuid() }).safeParse(request.params);
  const body = z.object({ body: z.string().trim().min(1).max(10000) }).strict().safeParse(request.body);
  if (!customer || !params.success || !body.success) throw new AppError(!customer ? 401 : 400, !customer ? "AUTHENTICATION_REQUIRED" : "VALIDATION_ERROR", !customer ? "Authentication required" : "Invalid comment data");
  const ticket = await ticketRepository.findForCustomer(customer.organizationId, customer.id, params.data.id);
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const comment = await ticketCommentRepository.createForCustomer(params.data.id, customer.id, body.data.body);
  response.status(201).json({ success: true, data: { comment } });
});
