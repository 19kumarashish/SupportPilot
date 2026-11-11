import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { pinoHttp } from "pino-http";

import { logger } from "./infrastructure/logger/index.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";
import { env } from "./config/env.js";
import { createApiRateLimiters } from "./shared/security/rate-limit.js";

export const createApp = (): express.Express => {
  const app = express();

  app.use(helmet());
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }));
  app.use(compression());

  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  app.use(
    pinoHttp({
      logger,
      redact: [
        "req.body",
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-api-key",
      ],
    }),
  );

  const { apiLimiter } = createApiRateLimiters();
  app.use("/api/v1", apiLimiter);

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