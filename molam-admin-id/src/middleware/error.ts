// src/middleware/error.ts
import { Request, Response } from 'express';


export function errorHandler(err: any, req: Request, res: Response) {
    const status = err.status || 500;

    // Log error details for debugging
    console.error('Admin API Error:', {
        message: err.message,
        stack: err.stack,
        status: status,
        url: req.url,
        method: req.method,
        userId: req.user?.sub
    });

    // Structured error response
    const errorResponse: any = {
        error: err.message || 'internal_error'
    };

    // Include validation errors if available
    if (err.errors) {
        errorResponse.details = err.errors;
    }

    // Include stack trace in development
    if (process.env['NODE_ENV'] === 'development') {
        errorResponse.stack = err.stack;
    }

    res.status(status).json(errorResponse);
}