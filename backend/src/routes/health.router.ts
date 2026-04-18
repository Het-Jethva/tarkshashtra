import { Router } from "express";

import type { ApiSuccess } from "../lib/http.js";

type HealthResponse = {
  status: "ok";
  timestamp: string;
};

const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const payload: ApiSuccess<HealthResponse> = {
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(payload);
});

export { healthRouter };
