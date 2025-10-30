// src/middlewares/metrics.ts
import { Request, Response, NextFunction } from 'express';
import { metrics } from '../services/metrics.js';

/**
 * Middleware to track request duration
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    metrics.requestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode.toString(),
      },
      duration
    );
  });

  next();
}
