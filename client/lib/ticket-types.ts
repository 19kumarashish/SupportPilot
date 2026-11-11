export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketSlaStatus = "on_track" | "at_risk" | "breached" | "completed";

export interface Ticket {
  id: string;
  organizationId: string;
  customerId: string;
  assignedTo: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
  responseDeadline?: string;
  slaStatus?: TicketSlaStatus;
  isSlaBreached?: boolean;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  uploaderId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId?: string;
  name: string;
  email: string | null;
  phone?: string | null;
  company: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent";
  isActive: boolean;
}

export interface TicketCategory {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketTag {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
