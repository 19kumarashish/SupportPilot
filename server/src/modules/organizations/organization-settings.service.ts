import { AppError } from "../../shared/errors/app-error.js";
import { recordAuditEvent } from "../../shared/security/audit.js";
import { slaRepository } from "../sla/repositories/sla.repository.js";
import { organizationSettingsRepository } from "./organization-settings.repository.js";
import type { OrganizationSettingsInput } from "./organization-settings.validators.js";

export const organizationSettingsService = {
  async get(organizationId: string) {
    const settings = await organizationSettingsRepository.getOrCreate(organizationId);
    if (!settings) throw new AppError(500, "ORGANIZATION_SETTINGS_UNAVAILABLE", "Organization settings are unavailable");
    return settings;
  },

  async update(organizationId: string, actorUserId: string, input: OrganizationSettingsInput) {
    if (input.defaultSlaPolicyId) {
      const policy = await slaRepository.findByIdInOrganization(organizationId, input.defaultSlaPolicyId);
      if (!policy) throw new AppError(400, "SLA_POLICY_NOT_FOUND", "The default SLA policy must belong to this organization");
    }
    await this.get(organizationId);
    const settings = await organizationSettingsRepository.update(organizationId, input);
    if (!settings) throw new AppError(500, "ORGANIZATION_SETTINGS_UPDATE_FAILED", "Failed to update organization settings");
    await recordAuditEvent({ organizationId, actorUserId, eventType: "organization_settings.updated", resourceType: "organization_settings", resourceId: organizationId });
    return settings;
  },
};
