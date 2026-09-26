import { AppError } from "../../../shared/errors/app-error.js";
import { organizationRepository } from "../repositories/organization.repository.js";
import type { OrganizationResponse } from "../types/organization.types.js";

export const organizationService = {
  async getCurrentOrganization(
    organizationId: string,
  ): Promise<OrganizationResponse> {
    const organization = await organizationRepository.findById(
      organizationId,
    );

    if (!organization) {
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found",
      );
    }

    return organization;
  },
};