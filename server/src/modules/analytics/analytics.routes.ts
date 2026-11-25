import { Router } from "express";

import { AppError } from "../../shared/errors/app-error.js";
import { getTenantContext } from "../../shared/tenant-context.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { analyticsService } from "./analytics.service.js";
import { analyticsOverviewQuerySchema } from "./analytics.validators.js";

export const analyticsRouter: Router = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/overview", async (request, response) => {
  const { organizationId } = getTenantContext(request);
  const parsed = analyticsOverviewQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid analytics query");
  }

  const overview = await analyticsService.getOverview(
    organizationId,
    parsed.data.range,
  );
  response.json({ success: true, data: overview });
});
