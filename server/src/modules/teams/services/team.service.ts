import { AppError } from "../../../shared/errors/app-error.js";
import { recordAuditEvent } from "../../../shared/security/audit.js";
import { teamRepository } from "../repositories/team.repository.js";
import type { MembershipInput, TeamInput, TeamUpdateInput } from "../types/team.types.js";

const notFound = () => new AppError(404, "TEAM_NOT_FOUND", "Team not found");
const conflict = () => new AppError(409, "TEAM_ALREADY_EXISTS", "A team with this name or slug already exists");

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export const teamService = {
  async list(organizationId: string) {
    const teams = await teamRepository.listInOrganization(organizationId);
    return Promise.all(teams.map(async (team) => ({
      ...team,
      members: await teamRepository.listMembers(organizationId, team.id),
    })));
  },

  async create(organizationId: string, actorUserId: string, input: TeamInput) {
    try {
      const team = await teamRepository.create(organizationId, input);
      if (!team) throw new AppError(500, "TEAM_CREATION_FAILED", "Failed to create team");
      await recordAuditEvent({ organizationId, actorUserId, eventType: "team.created", resourceType: "team", resourceId: team.id });
      return team;
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict();
      throw error;
    }
  },

  async update(organizationId: string, actorUserId: string, teamId: string, input: TeamUpdateInput) {
    try {
      const team = await teamRepository.updateInOrganization(organizationId, teamId, input);
      if (!team) throw notFound();
      await recordAuditEvent({ organizationId, actorUserId, eventType: "team.updated", resourceType: "team", resourceId: team.id });
      return team;
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict();
      throw error;
    }
  },

  async remove(organizationId: string, actorUserId: string, teamId: string) {
    const team = await teamRepository.deleteInOrganization(organizationId, teamId);
    if (!team) throw notFound();
    await recordAuditEvent({ organizationId, actorUserId, eventType: "team.deleted", resourceType: "team", resourceId: teamId });
  },

  async addMember(organizationId: string, actorUserId: string, teamId: string, input: MembershipInput) {
    if (!await teamRepository.findInOrganization(organizationId, teamId)) throw notFound();
    const user = await teamRepository.findUser(organizationId, input.userId);
    if (!user || !user.isActive) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    try {
      const membership = await teamRepository.addMember(organizationId, teamId, input.userId, input.role);
      if (!membership) throw new AppError(500, "MEMBERSHIP_CREATION_FAILED", "Failed to add team member");
      await recordAuditEvent({ organizationId, actorUserId, eventType: "team.member_added", resourceType: "team_membership", resourceId: membership.id, metadata: { teamId, userId: input.userId } });
      return membership;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, "MEMBERSHIP_ALREADY_EXISTS", "User is already a member of this team");
      throw error;
    }
  },

  async removeMember(organizationId: string, actorUserId: string, teamId: string, userId: string) {
    const membership = await teamRepository.removeMember(organizationId, teamId, userId);
    if (!membership) throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "Team membership not found");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "team.member_removed", resourceType: "team_membership", resourceId: membership.id, metadata: { teamId, userId } });
  },
};
