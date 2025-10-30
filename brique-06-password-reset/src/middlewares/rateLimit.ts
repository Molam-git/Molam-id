// src/middlewares/rateLimit.ts
import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis.js';
import { env } from '../config/env.js';
import { metrics } from '../services/metrics.js';
import { detectBruteForce } from '../services/sira.js';

/**
 * Sliding window rate limiter using Redis
 */
export function slidingWindowLimit(
  prefix: string,
  windowSec: number,
  max: number,
  keyFromReq: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${prefix}:${keyFromReq(req)}`;
      const now = Date.now();
      const windowStart = now - windowSec * 1000;

      // Remove old entries
      await redis.zRemRangeByScore(key, 0, windowStart);

      // Add current request
      await redis.zAdd(key, [{ score: now, value: `${now}:${Math.random()}` }]);

      // Get count
      const count = await redis.zCard(key);

      // Set expiry
      await redis.expire(key, windowSec);

      // Check limit
      if (count > max) {
        metrics.rateLimited.inc({ route: prefix });

        // SIRA: Detect brute force
        await detectBruteForce(keyFromReq(req), count, windowSec);

        return res.status(429).json({ error: 'RATE_LIMITED' });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      // Fail open (allow request if Redis is down)
      next();
    }
  };
}

/**
 * Rate limiter for password reset endpoints
 */
export const rateLimitPasswordForgot = slidingWindowLimit(
  'pwd-forgot',
  env.RATE_LIMIT_WINDOW_S,
  env.RATE_LIMIT_MAX,
  (req) => req.ip || 'unknown'
);

/**
 * Rate limiter for PIN reset endpoints
 */
export const rateLimitPinForgot = slidingWindowLimit(
  'pin-forgot',
  env.RATE_LIMIT_WINDOW_S,
  env.RATE_LIMIT_MAX,
  (req) => req.ip || 'unknown'
);
