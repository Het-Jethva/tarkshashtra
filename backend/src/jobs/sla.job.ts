import cron from "node-cron";

import { logger } from "../config/logger.js";
import { slaService } from "../modules/sla/sla.service.js";

let running = false;

export function startSlaJob(): void {
  cron.schedule("* * * * *", async () => {
    if (running) {
      logger.warn("Skipping SLA scan because previous run is still active");
      return;
    }

    running = true;
    try {
      const result = await slaService.runSlaScan();
      if (result.breachesCreated > 0 || result.warningsCreated > 0) {
        logger.info("SLA scan completed", result);
      }
    } catch (error) {
      logger.error("SLA scan failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      running = false;
    }
  });

  logger.info("SLA cron job scheduled");
}
