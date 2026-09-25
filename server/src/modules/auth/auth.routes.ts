import { Router } from "express";

import { getCurrentUser } from "./auth.me.controller.js";
import { login, logout, refresh } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter: Router = Router();

authRouter.post("/login", login);

authRouter.post("/refresh", refresh);

authRouter.post("/logout", requireAuth, logout);

authRouter.get("/me", requireAuth, getCurrentUser);