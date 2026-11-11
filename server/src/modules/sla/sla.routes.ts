import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createSlaPolicy,
  deleteSlaPolicy,
  listSlaPolicies,
  updateSlaPolicy,
} from "./sla.controller.js";

export const slaRouter: Router = Router();

slaRouter.use(requireAuth);
slaRouter.get("/policies", listSlaPolicies);
slaRouter.post("/policies", requireRole("admin"), createSlaPolicy);
slaRouter.patch("/policies/:id", requireRole("admin"), updateSlaPolicy);
slaRouter.delete("/policies/:id", requireRole("admin"), deleteSlaPolicy);
