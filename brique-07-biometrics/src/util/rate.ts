// src/util/rate.ts
import { Request, Response, NextFunction } from "express";
import { redis } from "./redis.js";
import { config } from "../config/index.js";

/**
 * Sliding window rate limiter using Redis
 */
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Use user ID if authenticated, otherwise IP
    const identifier = req.user?.sub || req.ip || "unknown";
    const key = `rate:${identifier}:${req.path}`;
    const ttl = Math.floor(config.rateLimit.windowMs / 1000);
    const max = config.rateLimit.max;

    // Increment counter
    const count = await redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, ttl);
    }

    // Check limit
    if (count > max) {
      return res.status(429).json({
        error: "rate_limited",
        message: `Too many requests. Max ${max} per ${ttl}s`,
      });
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count).toString());
    res.setHeader("X-RateLimit-Reset", (Math.floor(Date.now() / 1000) + ttl).toString());

    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    // Fail open: allow request if Redis is down
    next();
  }
}

/**
 * Create custom rate limiter with different limits
 */
export function createRateLimiter(maxRequests: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.user?.sub || req.ip || "unknown";
      const key = `rate:custom:${identifier}:${req.path}`;

      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        return res.status(429).json({
          error: "rate_limited",
          message: `Too many requests. Max ${maxRequests} per ${windowSeconds}s`,
        });
      }

      next();
    } catch (err) {
      console.error("Rate limiter error:", err);
      next();
    }
  };
}
