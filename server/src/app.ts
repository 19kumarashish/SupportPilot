import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { pinoHttp } from "pino-http";

import { logger } from "./infrastructure/logger/index.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const createApp = (): express.Express => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(pinoHttp({ logger }));

  app.get("/", (_request, response) => {
    response.json({
      success: true,
      data: {
        name: "SupportPilot API",
        status: "running",
      },
    });
  });

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};