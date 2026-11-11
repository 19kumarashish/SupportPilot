import { Router } from "express";

import { requireAuth, requireRole } from "../../auth/auth.middleware.js";
import { acceptInvitation, createInvitation, listInvitations, lookupInvitation, revokeInvitation } from "./invitation.controller.js";

export const invitationAdminRouter: Router = Router();
invitationAdminRouter.use(requireAuth, requireRole("admin"));
invitationAdminRouter.get("/", listInvitations);
invitationAdminRouter.post("/", createInvitation);
invitationAdminRouter.delete("/:id", revokeInvitation);

export const publicInvitationRouter: Router = Router();
publicInvitationRouter.get("/:token", lookupInvitation);
publicInvitationRouter.post("/accept", acceptInvitation);
