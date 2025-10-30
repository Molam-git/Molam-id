/**
 * Error Handling Utilities
 */

import { Request, Response, NextFunction } from "express";
import { logError } from "./auth";

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code?: string) {
    super(400, message, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", code?: string) {
    super(401, message, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", code?: string) {
    super(403, message, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not found", code?: string) {
    super(404, message, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict", code?: string) {
    super(409, message, code);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public errors?: any[]
  ) {
    super(400, message, "VALIDATION_ERROR");
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logError(req, err);

  // Handle custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      code: err.code,
      ...(err instanceof ValidationError && { errors: err.errors }),
    });
    return;
  }

  // Handle Zod validation errors
  if (err.name === "ZodError") {
    const zodError = err as any;
    res.status(400).json({
      error: "ValidationError",
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: zodError.errors,
    });
    return;
  }

  // Handle PostgreSQL errors
  if ((err as any).code) {
    const pgError = err as any;

    // Unique constraint violation
    if (pgError.code === "23505") {
      res.status(409).json({
        error: "ConflictError",
        message: "Resource already exists",
        code: "DUPLICATE_ENTRY",
        detail: pgError.detail,
      });
      return;
    }

    // Foreign key violation
    if (pgError.code === "23503") {
      res.status(400).json({
        error: "BadRequestError",
        message: "Referenced resource not found",
        code: "FOREIGN_KEY_VIOLATION",
        detail: pgError.detail,
      });
      return;
    }

    // Check constraint violation
    if (pgError.code === "23514") {
      res.status(400).json({
        error: "BadRequestError",
        message: "Invalid data",
        code: "CHECK_VIOLATION",
        detail: pgError.detail,
      });
      return;
    }
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      error: "UnauthorizedError",
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      error: "UnauthorizedError",
      message: "Token expired",
      code: "TOKEN_EXPIRED",
    });
    return;
  }

  // Default 500 error
  res.status(500).json({
    error: "InternalServerError",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: "NotFoundError",
    message: `Route not found: ${req.method} ${req.path}`,
    code: "ROUTE_NOT_FOUND",
  });
}

/**
 * Async handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
