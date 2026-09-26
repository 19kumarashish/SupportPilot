import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { getCurrentOrganization } from "./organization.controller.js";

export const organizationRouter: Router = Router();

organizationRouter.get("/me", requireAuth, getCurrentOrganization);