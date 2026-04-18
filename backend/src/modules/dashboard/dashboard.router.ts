import { Router } from "express";

import { createId } from "../../lib/id.js";
import { asyncHandler, type ApiSuccess } from "../../lib/http.js";
import { sseHub } from "../../lib/sse-hub.js";
import { dashboardService } from "./dashboard.service.js";

const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const summary = await dashboardService.getSummary();

    const response: ApiSuccess<typeof summary> = {
      success: true,
      data: summary,
    };

    res.status(200).json(response);
  }),
);

dashboardRouter.get(
  "/sla-overview",
  asyncHandler(async (_req, res) => {
    const result = await dashboardService.getSlaOverview();

    const response: ApiSuccess<typeof result> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  }),
);

dashboardRouter.get(
  "/workload",
  asyncHandler(async (_req, res) => {
    const result = await dashboardService.getWorkloadDistribution();

    const response: ApiSuccess<typeof result> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  }),
);

dashboardRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = createId("sse");
  const write = (chunk: string): void => {
    res.write(chunk);
  };

  const close = (): void => {
    res.end();
  };

  sseHub.addClient({ id: clientId, write, close });

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  const heartbeatTimer = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeatTimer);
    sseHub.removeClient(clientId);
  });
});

export { dashboardRouter };
