import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { organizationInvitations } from "../../../db/schema/organization-invitations.js";
import { teamMemberships } from "../../../db/schema/team-memberships.js";
import { teams } from "../../../db/schema/teams.js";
import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";

export const invitationRepository = {
  list(organizationId: string) {
    return db.select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      teamId: organizationInvitations.teamId,
      expiresAt: organizationInvitations.expiresAt,
      acceptedAt: organizationInvitations.acceptedAt,
      revokedAt: organizationInvitations.revokedAt,
      createdAt: organizationInvitations.createdAt,
    }).from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, organizationId))
      .orderBy(sql`${organizationInvitations.createdAt} DESC`);
  },

  async create(input: typeof organizationInvitations.$inferInsert) {
    const [invitation] = await db.insert(organizationInvitations).values(input).returning();
    return invitation ?? null;
  },

  revoke(organizationId: string, id: string) {
    return db.update(organizationInvitations).set({ revokedAt: new Date() })
      .where(and(eq(organizationInvitations.organizationId, organizationId), eq(organizationInvitations.id, id), isNull(organizationInvitations.acceptedAt), isNull(organizationInvitations.revokedAt)))
      .returning({ id: organizationInvitations.id }).then(([row]) => row ?? null);
  },

  findUsableByHash(tokenHash: string) {
    return db.select().from(organizationInvitations).where(and(
      eq(organizationInvitations.tokenHash, tokenHash),
      isNull(organizationInvitations.acceptedAt),
      isNull(organizationInvitations.revokedAt),
      gt(organizationInvitations.expiresAt, new Date()),
    )).limit(1).then(([row]) => row ?? null);
  },

  findTeamInOrganization(organizationId: string, teamId: string) {
    return db.select({ id: teams.id }).from(teams)
      .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
      .limit(1).then(([team]) => team ?? null);
  },

  async consumeAndCreateUser(input: {
    invitationId: string;
    organizationId: string;
    tokenHash: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role: "admin" | "agent";
    teamId: string | null;
  }) {
    return db.transaction(async (transaction) => {
      const [invitation] = await transaction.update(organizationInvitations)
        .set({ acceptedAt: new Date() })
        .where(and(
          eq(organizationInvitations.id, input.invitationId),
          eq(organizationInvitations.organizationId, input.organizationId),
          eq(organizationInvitations.tokenHash, input.tokenHash),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        )).returning();
      if (!invitation) return null;
      const [user] = await transaction.insert(users).values({
        organizationId: input.organizationId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        isActive: true,
      }).returning();
      if (!user) return null;
      if (input.teamId) {
        const [team] = await transaction.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.organizationId, input.organizationId))).limit(1);
        if (team) {
          await transaction.insert(teamMemberships).values({ organizationId: input.organizationId, teamId: team.id, userId: user.id, role: "member" });
        }
      }
      return user;
    });
  },
};
