import { Router } from "express";

import { getCurrentUser } from "./auth.me.controller.js";
import { login } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter: Router = Router();

authRouter.post("/login", login);

authRouter.get("/me", requireAuth, getCurrentUser);