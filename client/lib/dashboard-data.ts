import type {
  PageResult,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "./ticket-types";

export interface TicketBreakdown {
  total: number;
  sampleSize: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
}

export function summarizeTickets(
  result: PageResult<Ticket>,
): TicketBreakdown {
  const byStatus: Record<TicketStatus, number> = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
  const byPriority: Record<TicketPriority, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const ticket of result.items) {
    byStatus[ticket.status] += 1;
    byPriority[ticket.priority] += 1;
  }

  return {
    total: result.total,
    sampleSize: result.items.length,
    byStatus,
    byPriority,
  };
}
