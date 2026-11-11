import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error.js";
import { getTenantContext } from "../../../shared/tenant-context.js";
import { invitationService } from "./invitation.service.js";
import { createInvitationSchema, invitationIdParamsSchema, invitationTokenSchema } from "./invitation.validators.js";

const invalid = () => new AppError(400, "VALIDATION_ERROR", "Invalid invitation data");

export const listInvitations: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { invitations: await invitationService.list(organizationId) } });
};

export const createInvitation: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const parsed = createInvitationSchema.safeParse(request.body);
  if (!parsed.success) throw invalid();
  response.status(201).json({ success: true, data: { invitation: await invitationService.create(tenant.organizationId, tenant.userId, parsed.data) } });
};

export const revokeInvitation: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const params = invitationIdParamsSchema.safeParse(request.params);
  if (!params.success) throw invalid();
  await invitationService.revoke(tenant.organizationId, tenant.userId, params.data.id);
  response.json({ success: true, data: { message: "Invitation revoked successfully" } });
};

export const lookupInvitation: RequestHandler = async (request, response) => {
  const parsed = invitationTokenSchema.safeParse(request.params);
  if (!parsed.success) throw invalid();
  response.json({ success: true, data: { invitation: await invitationService.lookup(parsed.data.token) } });
};

export const acceptInvitation: RequestHandler = async (request, response) => {
  const parsed = (await import("./invitation.validators.js")).acceptInvitationSchema.safeParse(request.body);
  if (!parsed.success) throw invalid();
  response.status(201).json({ success: true, data: await invitationService.accept(parsed.data) });
};
