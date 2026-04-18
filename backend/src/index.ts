import "dotenv/config";

import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { closeDatabasePool } from "./db/client.js";
import { startSlaJob } from "./jobs/sla.job.js";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info("Server started", { port: env.PORT, nodeEnv: env.NODE_ENV });
  if (env.ENABLE_SLA_JOB) {
    startSlaJob();
  }
});

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    logger.info("Shutdown signal received", { signal });
    server.close(async () => {
      try {
        await closeDatabasePool();
      } catch (error) {
        logger.error("Error while closing database pool", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      logger.info("HTTP server stopped");
      process.exit(0);
    });
  });
}
