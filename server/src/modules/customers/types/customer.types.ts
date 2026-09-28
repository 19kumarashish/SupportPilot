import type { customers } from "../../../db/schema/customers.js";

export type Customer = typeof customers.$inferSelect;

export type CustomerResponse = Pick<
  Customer,
  | "id"
  | "organizationId"
  | "name"
  | "email"
  | "phone"
  | "company"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>;

export type CreateCustomerInput = {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  company?: string | undefined;
};

export type UpdateCustomerInput = {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  company?: string | undefined;
};

export type CustomerStatusInput = {
  isActive: boolean;
};

export type PaginationQuery = {
  page: number;
  limit: number;
};

export type PaginatedCustomerResponse = {
  items: CustomerResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};