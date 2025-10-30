// Error handling utilities

import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // PostgreSQL errors
  if (err.code) {
    console.error("Database error:", err);
    res.status(500).json({
      error: {
        code: "database_error",
        message: "Database error occurred",
      },
    });
    return;
  }

  // Generic errors
  console.error("Unexpected error:", err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Internal server error",
    },
  });
}
