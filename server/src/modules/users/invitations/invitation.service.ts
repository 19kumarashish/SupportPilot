import { randomBytes } from "node:crypto";

import { AppError } from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/security/password.js";
import { hashToken } from "../../../shared/security/token.js";
import { recordAuditEvent } from "../../../shared/security/audit.js";
import { env } from "../../../config/env.js";
import { authService } from "../../auth/services/auth.service.js";
import { deliverInvitationEmail } from "../../../workers/jobs.js";
import { invitationRepository } from "./invitation.repository.js";
import type { z } from "zod";
import { acceptInvitationSchema, createInvitationSchema } from "./invitation.validators.js";

type CreateInput = z.infer<typeof createInvitationSchema>;
type AcceptInput = z.infer<typeof acceptInvitationSchema>;

const invitationNotFound = () => new AppError(404, "INVITATION_NOT_FOUND", "Invitation not found or expired");

export const invitationService = {
  async list(organizationId: string) {
    return invitationRepository.list(organizationId);
  },

  async create(organizationId: string, actorUserId: string, input: CreateInput) {
    if (input.teamId && !await invitationRepository.findTeamInOrganization(organizationId, input.teamId)) {
      throw new AppError(400, "TEAM_NOT_FOUND", "The invitation team must belong to this organization");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await invitationRepository.create({
      organizationId,
      email: input.email,
      role: input.role,
      teamId: input.teamId ?? null,
      tokenHash: hashToken(token),
      invitedByUserId: actorUserId,
      expiresAt,
    });
    if (!invitation) throw new AppError(500, "INVITATION_CREATION_FAILED", "Failed to create invitation");
    const invitationUrl = new URL("/invite/" + token, env.PUBLIC_APP_URL).toString();
    await deliverInvitationEmail({ organizationId, to: input.email, invitationUrl, expiresAt });
    await recordAuditEvent({ organizationId, actorUserId, eventType: "organization_invitation.created", resourceType: "organization_invitation", resourceId: invitation.id });
    return { ...invitation, token: undefined, invitationUrl };
  },

  async revoke(organizationId: string, actorUserId: string, id: string) {
    const revoked = await invitationRepository.revoke(organizationId, id);
    if (!revoked) throw invitationNotFound();
    await recordAuditEvent({ organizationId, actorUserId, eventType: "organization_invitation.revoked", resourceType: "organization_invitation", resourceId: id });
  },

  async lookup(token: string) {
    const invitation = await invitationRepository.findUsableByHash(hashToken(token));
    if (!invitation) throw invitationNotFound();
    return { email: invitation.email, role: invitation.role, teamId: invitation.teamId, expiresAt: invitation.expiresAt };
  },

  async accept(input: AcceptInput) {
    const tokenHash = hashToken(input.token);
    const invitation = await invitationRepository.findUsableByHash(tokenHash);
    if (!invitation) throw invitationNotFound();
    const passwordHash = await hashPassword(input.password);
    const user = await invitationRepository.consumeAndCreateUser({
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      tokenHash,
      email: invitation.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: invitation.role,
      teamId: invitation.teamId,
    });
    if (!user) throw invitationNotFound();
    await recordAuditEvent({ organizationId: user.organizationId, actorUserId: user.id, eventType: "organization_invitation.accepted", resourceType: "organization_invitation", resourceId: invitation.id });
    return authService.issueTokensForUser(user);
  },
};
