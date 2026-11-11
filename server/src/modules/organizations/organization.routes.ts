import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { getCurrentOrganization } from "./organization.controller.js";
import { getOrganizationSettings, updateOrganizationSettings } from "./organization-settings.controller.js";
import { requireRole } from "../auth/auth.middleware.js";

export const organizationRouter: Router = Router();

organizationRouter.get("/me", requireAuth, getCurrentOrganization);
organizationRouter.get("/settings", requireAuth, getOrganizationSettings);
organizationRouter.patch("/settings", requireAuth, requireRole("admin"), updateOrganizationSettings);