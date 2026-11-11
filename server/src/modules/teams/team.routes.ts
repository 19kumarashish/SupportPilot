import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { addMember, createTeam, deleteTeam, listTeams, removeMember, updateTeam } from "./team.controller.js";

export const teamRouter: Router = Router();
teamRouter.use(requireAuth);
teamRouter.get("/", listTeams);
teamRouter.post("/", requireRole("admin"), createTeam);
teamRouter.patch("/:teamId", requireRole("admin"), updateTeam);
teamRouter.delete("/:teamId", requireRole("admin"), deleteTeam);
teamRouter.post("/:teamId/members", requireRole("admin"), addMember);
teamRouter.delete("/:teamId/members/:userId", requireRole("admin"), removeMember);
