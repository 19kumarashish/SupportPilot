import type { tickets } from "../../../db/schema/tickets.js";
import type {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketStatusSchema,
  updateTicketSchema,
} from "../validators/ticket.validators.js";

export type Ticket = typeof tickets.$inferSelect;

export type TicketResponse = Pick<
  Ticket,
  | "id"
  | "organizationId"
  | "customerId"
  | "subject"
  | "description"
  | "status"
  | "priority"
  | "createdAt"
  | "updatedAt"
>;

export type CreateTicketInput = ReturnType<typeof createTicketSchema.parse>;

export type UpdateTicketInput = ReturnType<
  typeof updateTicketSchema.parse
>;

export type TicketStatusInput = ReturnType<
  typeof ticketStatusSchema.parse
>;

export type ListTicketsQuery = ReturnType<typeof listTicketsQuerySchema.parse>;

export type PaginatedTicketResponse = {
  items: TicketResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
