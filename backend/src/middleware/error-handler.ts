import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../lib/errors.js";
import type { ApiError } from "../lib/http.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: { issues: error.flatten() },
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  logger.error("Unhandled server error", {
    error: error instanceof Error ? error.message : "Unknown error",
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: env.NODE_ENV === "production" ? "Something went wrong" : String(error),
    },
  });
}
