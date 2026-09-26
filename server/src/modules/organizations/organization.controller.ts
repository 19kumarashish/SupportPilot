import type { RequestHandler } from "express";

import { getTenantContext } from "../../shared/tenant-context.js";
import { organizationService } from "./services/organization.service.js";

export const getCurrentOrganization: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const { organizationId } = getTenantContext(request);
    const organization =
      await organizationService.getCurrentOrganization(organizationId);

    response.status(200).json({
      success: true,
      data: {
        organization,
      },
    });
  } catch (error) {
    next(error);
  }
};