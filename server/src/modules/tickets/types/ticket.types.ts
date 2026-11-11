
import type { tickets } from "../../../db/schema/tickets.js";
import type {
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketStatusSchema,
  updateTicketSchema,
  bulkTicketActionSchema,
} from "../validators/ticket.validators.js";

export type Ticket = typeof tickets.$inferSelect;

export type TicketSlaStatus =
  | "on_track"
  | "at_risk"
  | "breached"
  | "completed";

export type TicketResponse = Pick<
  Ticket,
  | "id"
  | "organizationId"
  | "customerId"
  | "assignedTo"
  | "subject"
  | "description"
  | "status"
  | "priority"
  | "createdAt"
  | "updatedAt"
> & {
  assignedTeamId?: string | null;
  firstResponseDeadlineAt?: string;
  resolutionDeadlineAt?: string;
  firstRespondedAt?: string;
  slaBreachedAt?: string;
  slaDeadline?: string;
  responseDeadline?: string;
  slaStatus?: TicketSlaStatus;
  isSlaBreached?: boolean;
};

export type CreateTicketInput = ReturnType<typeof createTicketSchema.parse>;

export type UpdateTicketInput = ReturnType<
  typeof updateTicketSchema.parse
>;

export type TicketStatusInput = ReturnType<
  typeof ticketStatusSchema.parse
>;

export type AssignTicketInput = ReturnType<
  typeof assignTicketSchema.parse
>;

export type ListTicketsQuery = ReturnType<typeof listTicketsQuerySchema.parse>;

export type BulkTicketActionInput = ReturnType<typeof bulkTicketActionSchema.parse>;

export type PaginatedTicketResponse = {
  items: TicketResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
