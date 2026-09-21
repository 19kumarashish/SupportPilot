import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);