import { getRedis } from '../services/redis.js';
import { env } from '../config/env.js';

/**
 * Sliding window rate limiter using Redis
 * @param {string} prefix - Redis key prefix
 * @param {number} windowSec - Time window in seconds
 * @param {number} max - Max requests per window
 * @param {function} keyFn - Function to extract key from request
 */
export function rateLimit(prefix, windowSec, max, keyFn) {
  return async (req, res, next) => {
    try {
      const redis = await getRedis();
      const key = `${prefix}:${keyFn(req)}`;
      const now = Date.now();

      // Remove old entries
      await redis.zRemRangeByScore(key, 0, now - windowSec * 1000);

      // Add current request
      await redis.zAdd(key, [{ score: now, value: `${now}:${Math.random()}` }]);

      // Count requests in window
      const count = await redis.zCard(key);

      // Set expiry
      await redis.expire(key, windowSec);

      // Add headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + windowSec);

      if (count > max) {
        return res.status(429).json({
          error: 'RATE_LIMITED',
          message: 'Too many requests',
          retry_after: windowSec
        });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      // Fail open (don't block request if Redis is down)
      next();
    }
  };
}

/**
 * Rate limit for password forgot endpoint
 */
export const rateLimitPasswordForgot = rateLimit(
  'pwd-forgot',
  env.RATE_LIMIT_WINDOW_S,
  env.RATE_LIMIT_MAX,
  (req) => req.ip || 'unknown'
);

/**
 * Rate limit for PIN forgot endpoint
 */
export const rateLimitPinForgot = rateLimit(
  'pin-forgot',
  env.RATE_LIMIT_WINDOW_S,
  env.RATE_LIMIT_MAX,
  (req) => req.ip || 'unknown'
);
