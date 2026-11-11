import type { RequestHandler } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { organizationSettingsService } from "./organization-settings.service.js";
import { organizationSettingsSchema } from "./organization-settings.validators.js";

export const getOrganizationSettings: RequestHandler = async (request, response) => {
  const { organizationId } = getTenantContext(request);
  response.json({ success: true, data: { settings: await organizationSettingsService.get(organizationId) } });
};

export const updateOrganizationSettings: RequestHandler = async (request, response) => {
  const tenant = getTenantContext(request);
  const parsed = organizationSettingsSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid organization settings");
  response.json({ success: true, data: { settings: await organizationSettingsService.update(tenant.organizationId, tenant.userId, parsed.data) } });
};
