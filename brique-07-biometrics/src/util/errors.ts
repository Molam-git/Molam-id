// src/util/errors.ts
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Handle known error types
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: (err as any).errors,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "invalid_token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "token_expired" });
  }

  // Generic error
  return res.status(500).json({ error: "internal_server_error" });
}
