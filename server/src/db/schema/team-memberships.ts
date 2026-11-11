import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { teams } from "./teams.js";

export const teamMembershipRoles = ["lead", "member"] as const;
export const teamMembershipRoleEnum = pgEnum("team_membership_role", teamMembershipRoles);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: teamMembershipRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_memberships_team_user_unique").on(table.teamId, table.userId),
    index("team_memberships_organization_idx").on(table.organizationId),
    index("team_memberships_user_idx").on(table.organizationId, table.userId),
  ],
);
