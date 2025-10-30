/**
 * Molam ID - Error Handler Middleware
 * Centralized error handling for Express
 */
import { Request, Response, NextFunction } from 'express';
import { ServiceError } from '../types';
import { ZodError } from 'zod';

/**
 * Global error handler
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle ServiceError (custom errors with status codes)
  if (err instanceof ServiceError) {
    res.status(err.status).json({
      error: err.code || 'ServiceError',
      message: err.message,
    });
    return;
  }

  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: err.message || 'Authentication required',
    });
    return;
  }

  // Default to 500 Internal Server Error
  const status = err.status || 500;
  res.status(status).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
