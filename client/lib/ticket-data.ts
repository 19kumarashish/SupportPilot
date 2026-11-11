import { apiJson } from "@/lib/api";
import type { Customer, TeamMember } from "@/lib/ticket-types";

const optionPageSize = 100;

interface CustomerPage {
  items: Customer[];
  totalPages: number;
}

interface UserPage {
  users: TeamMember[];
  pagination: { totalPages: number };
}

export async function loadAllCustomers(signal?: AbortSignal): Promise<Customer[]> {
  const firstPage = await apiJson<{ data: CustomerPage }>(
    `/customers?page=1&limit=${optionPageSize}`,
    { signal },
  );
  const customers = [...firstPage.data.items];

  for (let page = 2; page <= firstPage.data.totalPages; page += 1) {
    const result = await apiJson<{ data: CustomerPage }>(
      `/customers?page=${page}&limit=${optionPageSize}`,
      { signal },
    );
    customers.push(...result.data.items);
  }

  return customers;
}

export async function loadAllActiveAgents(
  signal?: AbortSignal,
): Promise<TeamMember[]> {
  const firstPage = await apiJson<{ data: UserPage }>(
    `/users?page=1&limit=${optionPageSize}`,
    { signal },
  );
  const members = [...firstPage.data.users];

  for (let page = 2; page <= firstPage.data.pagination.totalPages; page += 1) {
    const result = await apiJson<{ data: UserPage }>(
      `/users?page=${page}&limit=${optionPageSize}`,
      { signal },
    );
    members.push(...result.data.users);
  }

  return members.filter(
    (member) => member.isActive && member.role === "agent",
  );
}
