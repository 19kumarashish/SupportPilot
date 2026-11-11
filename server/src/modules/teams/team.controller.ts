import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { teamService } from "./services/team.service.js";
import { createTeamSchema, membershipParamsSchema, membershipSchema, teamIdParamsSchema, updateTeamSchema } from "./validators/team.validators.js";

const invalid = () => new AppError(400, "VALIDATION_ERROR", "Invalid team data");

export const listTeams: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { teams: await teamService.list(organizationId) } });
};

export const createTeam: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const parsed = createTeamSchema.safeParse(request.body);
  if (!parsed.success) throw invalid();
  response.status(201).json({ success: true, data: { team: await teamService.create(tenant.organizationId, tenant.userId, parsed.data) } });
};

export const updateTeam: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = teamIdParamsSchema.safeParse(request.params);
  const body = updateTeamSchema.safeParse(request.body);
  if (!params.success || !body.success) throw invalid();
  response.json({ success: true, data: { team: await teamService.update(tenant.organizationId, tenant.userId, params.data.teamId, body.data) } });
};

export const deleteTeam: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = teamIdParamsSchema.safeParse(request.params);
  if (!params.success) throw invalid();
  await teamService.remove(tenant.organizationId, tenant.userId, params.data.teamId);
  response.json({ success: true, data: { message: "Team deleted successfully" } });
};

export const addMember: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = teamIdParamsSchema.safeParse(request.params);
  const body = membershipSchema.safeParse(request.body);
  if (!params.success || !body.success) throw invalid();
  response.status(201).json({ success: true, data: { membership: await teamService.addMember(tenant.organizationId, tenant.userId, params.data.teamId, body.data) } });
};

export const removeMember: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = membershipParamsSchema.safeParse(request.params);
  if (!params.success) throw invalid();
  await teamService.removeMember(tenant.organizationId, tenant.userId, params.data.teamId, params.data.userId);
  response.json({ success: true, data: { message: "Team member removed successfully" } });
};
