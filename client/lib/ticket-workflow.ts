import { z } from "zod";

import type {
  Customer,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-types";

export function buildTicketListQuery(input: {
  page: number;
  pageSize: number;
  status: "" | TicketStatus;
  priority: "" | TicketPriority;
  customerId: string;
  search?: string;
  categoryId?: string;
  tagId?: string;
  assignedTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "subject" | "priority" | "status";
  sortDir?: "asc" | "desc";
}): string {
  const query = new URLSearchParams({
    page: String(input.page),
    limit: String(input.pageSize),
  });
  if (input.status) query.set("status", input.status);
  if (input.priority) query.set("priority", input.priority);
  if (input.customerId) query.set("customerId", input.customerId);
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.categoryId) query.set("categoryId", input.categoryId);
  if (input.tagId) query.set("tagId", input.tagId);
  if (input.assignedTo) query.set("assignedTo", input.assignedTo);
  if (input.sortBy) query.set("sortBy", input.sortBy);
  if (input.sortDir) query.set("sortDir", input.sortDir);
  return query.toString();
}

export const createTicketSchema = z.object({
  customerId: z.string().uuid("Choose a customer."),
  subject: z.string().trim().min(1, "Enter a subject.").max(255, "Subject must be 255 characters or fewer."),
  description: z.string().trim().min(1, "Enter a description.").max(10_000, "Description must be 10,000 characters or fewer."),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  categoryId: z.union([z.string().uuid(), z.null()]).optional(),
  tagIds: z.array(z.string().uuid()).max(20).optional(),
});

export function filterTicketsOnCurrentPage(
  tickets: Ticket[],
  customers: Customer[],
  search: string,
): Ticket[] {
  const searchTerm = search.trim().toLocaleLowerCase();
  if (!searchTerm) return tickets;

  return tickets.filter((ticket) => {
    const customerName = customers.find(
      (customer) => customer.id === ticket.customerId,
    )?.name;
    return [
      ticket.subject,
      ticket.id,
      ticket.customerId,
      customerName ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(searchTerm));
  });
}
