import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organizations } from "../../infrastructure/database/schema/organizations.js";
import { users } from "../../infrastructure/database/schema/users.js";
import { teams } from "./teams.js";

export const invitationRoles = ["admin", "agent"] as const;
export const invitationRoleEnum = pgEnum("organization_invitation_role", invitationRoles);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: invitationRoleEnum("role").notNull().default("agent"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    invitedByUserId: uuid("invited_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("organization_invitations_pending_email_unique")
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),
    index("organization_invitations_organization_idx").on(table.organizationId),
  ],
);
