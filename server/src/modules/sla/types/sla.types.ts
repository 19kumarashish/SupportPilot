import type { ticketPriorities } from "../../../db/schema/tickets.js";

export type TicketPriority = (typeof ticketPriorities)[number];

export interface SlaPolicy {
  id: string;
  organizationId: string;
  name: string;
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlaDeadlines {
  firstResponseDeadlineAt: Date;
  resolutionDeadlineAt: Date;
}
