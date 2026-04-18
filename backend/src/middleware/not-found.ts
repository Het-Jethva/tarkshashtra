import type { Request, Response } from "express";

import type { ApiError } from "../lib/http.js";

export function notFoundHandler(req: Request, res: Response<ApiError>): void {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}
