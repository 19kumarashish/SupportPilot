import { and, asc, eq } from "drizzle-orm";

import { db } from "../../../infrastructure/database/index.js";
import { users } from "../../../infrastructure/database/schema/users.js";
import { teamMemberships } from "../../../db/schema/team-memberships.js";
import { teams } from "../../../db/schema/teams.js";

export const teamRepository = {
  listInOrganization(organizationId: string) {
    return db.select().from(teams)
      .where(eq(teams.organizationId, organizationId))
      .orderBy(asc(teams.name));
  },

  findInOrganization(organizationId: string, teamId: string) {
    return db.select().from(teams)
      .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
      .limit(1).then(([team]) => team ?? null);
  },

  create(organizationId: string, input: { name: string; slug: string; description?: string | null | undefined }) {
    return db.insert(teams).values({ organizationId, ...input }).returning().then(([team]) => team ?? null);
  },

  updateInOrganization(organizationId: string, teamId: string, input: Partial<{ name: string | undefined; slug: string | undefined; description: string | null | undefined }>) {
    return db.update(teams).set({ ...input, updatedAt: new Date() })
      .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
      .returning().then(([team]) => team ?? null);
  },

  deleteInOrganization(organizationId: string, teamId: string) {
    return db.delete(teams)
      .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
      .returning({ id: teams.id }).then(([team]) => team ?? null);
  },

  listMembers(organizationId: string, teamId: string) {
    return db.select({
      id: teamMemberships.id,
      userId: teamMemberships.userId,
      role: teamMemberships.role,
      createdAt: teamMemberships.createdAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isActive: users.isActive,
    }).from(teamMemberships)
      .innerJoin(users, eq(users.id, teamMemberships.userId))
      .where(and(
        eq(teamMemberships.organizationId, organizationId),
        eq(teamMemberships.teamId, teamId),
      ))
      .orderBy(asc(users.lastName), asc(users.firstName));
  },

  async addMember(organizationId: string, teamId: string, userId: string, role: "lead" | "member") {
    const [membership] = await db.insert(teamMemberships)
      .values({ organizationId, teamId, userId, role })
      .returning();
    return membership ?? null;
  },

  removeMember(organizationId: string, teamId: string, userId: string) {
    return db.delete(teamMemberships).where(and(
      eq(teamMemberships.organizationId, organizationId),
      eq(teamMemberships.teamId, teamId),
      eq(teamMemberships.userId, userId),
    )).returning({ id: teamMemberships.id }).then(([membership]) => membership ?? null);
  },

  findUser(organizationId: string, userId: string) {
    return db.select({ id: users.id, role: users.role, isActive: users.isActive })
      .from(users).where(and(eq(users.organizationId, organizationId), eq(users.id, userId)))
      .limit(1).then(([user]) => user ?? null);
  },
};
