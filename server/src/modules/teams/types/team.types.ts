import type { teamMembershipRoles } from "../../../db/schema/team-memberships.js";

export type TeamMembershipRole = (typeof teamMembershipRoles)[number];

export interface TeamInput {
  name: string;
  slug: string;
  description?: string | null | undefined;
}

export interface TeamUpdateInput {
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | null | undefined;
}

export interface MembershipInput {
  userId: string;
  role: TeamMembershipRole;
}
