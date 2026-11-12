import type { TicketActivity, TicketRelation } from "./ticket-types";

export function sortTicketActivity(activity: TicketActivity[]): TicketActivity[] {
  return [...activity].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function relationLabel(relation: TicketRelation): string {
  return relation.relationType.replaceAll("_", " ");
}
