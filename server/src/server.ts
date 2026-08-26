import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger/index.js";
import { pool } from "./infrastructure/database/index.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

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

app.use("/health", healthRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    "SupportPilot API started",
  );
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received");

  server.close(async () => {
    try {
      await pool.end();

      logger.info("Database connection pool closed");
      process.exit(0);
    } catch (error) {
      logger.error({ error }, "Failed to close database connection pool");
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});