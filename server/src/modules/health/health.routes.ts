import { Router } from "express";

import { checkDatabaseConnection } from "../../infrastructure/database/index.js";

export const healthRouter: Router = Router();

healthRouter.get("/", async (_request, response) => {
  const databaseConnected = await checkDatabaseConnection();

  response.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: {
      status: databaseConnected ? "ok" : "degraded",
      database: databaseConnected ? "connected" : "disconnected",
    },
  });
});