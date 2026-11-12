import type { TicketPriority, TicketStatus } from "./ticket-types";

export type BulkTicketAction =
  | "assign"
  | "unassign"
  | "team"
  | "tags"
  | "status"
  | "priority"
  | "archive"
  | "restore";

export function buildBulkTicketPayload(input: {
  ticketIds: string[];
  action: BulkTicketAction;
  assignedTo?: string | null;
  assignedTeamId?: string | null;
  tagIds?: string[];
  status?: TicketStatus;
  priority?: TicketPriority;
}) {
  return {
    ticketIds: input.ticketIds,
    action: input.action,
    ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
    ...(input.assignedTeamId !== undefined ? { assignedTeamId: input.assignedTeamId } : {}),
    ...(input.tagIds !== undefined ? { tagIds: input.tagIds } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
  };
}
