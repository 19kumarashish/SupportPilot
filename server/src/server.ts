import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logger/index.js";
import { pool } from "./infrastructure/database/client.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    "SupportPilot API started",
  );
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info({ signal }, "Shutdown signal received");

  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      await pool.end();

      logger.info("Database pool closed");
      logger.info("Shutdown complete");

      process.exit(0);
    } catch (error) {
      logger.error(error, "Error during shutdown");
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