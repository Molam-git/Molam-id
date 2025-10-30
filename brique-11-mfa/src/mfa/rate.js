import { getRedis } from './repo.js';

/**
 * Rate limiting middleware using Redis
 * Implements sliding window counter algorithm
 */

/**
 * Rate limit by key (user ID, IP, etc.)
 * @param {object} options - Rate limit options
 * @param {number} options.maxAttempts - Max attempts per window
 * @param {number} options.windowSec - Time window in seconds
 * @param {string} options.prefix - Redis key prefix
 * @param {function} options.keyFn - Function to extract key from request
 */
export function rateLimit(options = {}) {
  const maxAttempts = options.maxAttempts || 5;
  const windowSec = options.windowSec || 300; // 5 minutes
  const prefix = options.prefix || 'rate_limit';
  const keyFn = options.keyFn || ((req) => req.ip);

  return async (req, res, next) => {
    try {
      const redis = await getRedis();
      const key = `${prefix}:${keyFn(req)}`;

      // Get current count
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxAttempts) {
        const ttl = await redis.ttl(key);
        return res.status(429).json({
          error: 'Too many attempts',
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after: ttl > 0 ? ttl : windowSec
        });
      }

      // Increment counter
      await redis.incr(key);

      // Set expiry on first request
      if (count === 0) {
        await redis.expire(key, windowSec);
      }

      // Add headers
      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - count - 1));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + windowSec);

      next();
    } catch (err) {
      console.error('Rate limit error:', err);
      // Fail open (don't block request if Redis is down)
      next();
    }
  };
}

/**
 * Rate limit OTP requests by user ID
 */
export const rateLimitOTP = rateLimit({
  maxAttempts: 3,
  windowSec: 300, // 5 minutes
  prefix: 'otp_request',
  keyFn: (req) => req.user?.user_id || req.body?.user_id || req.ip
});

/**
 * Rate limit verification attempts by challenge ID
 */
export const rateLimitVerify = rateLimit({
  maxAttempts: 5,
  windowSec: 300, // 5 minutes
  prefix: 'otp_verify',
  keyFn: (req) => req.body?.challenge_id || req.ip
});

/**
 * Rate limit enrollment by user ID
 */
export const rateLimitEnroll = rateLimit({
  maxAttempts: 10,
  windowSec: 3600, // 1 hour
  prefix: 'mfa_enroll',
  keyFn: (req) => req.user?.user_id || req.ip
});

/**
 * Check if user is locked out
 * @param {string} userId - User ID
 * @param {string} action - Action type (e.g., 'login', 'otp_verify')
 * @returns {Promise<object>} - { locked, retry_after }
 */
export async function checkLockout(userId, action = 'default') {
  try {
    const redis = await getRedis();
    const key = `lockout:${action}:${userId}`;

    const lockoutEnd = await redis.get(key);

    if (lockoutEnd) {
      const remaining = parseInt(lockoutEnd, 10) - Date.now();

      if (remaining > 0) {
        return {
          locked: true,
          retry_after: Math.ceil(remaining / 1000)
        };
      }
    }

    return { locked: false };
  } catch (err) {
    console.error('Lockout check error:', err);
    return { locked: false }; // Fail open
  }
}

/**
 * Apply lockout to user
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @param {number} durationSec - Lockout duration in seconds
 */
export async function applyLockout(userId, action = 'default', durationSec = 900) {
  try {
    const redis = await getRedis();
    const key = `lockout:${action}:${userId}`;
    const lockoutEnd = Date.now() + (durationSec * 1000);

    await redis.set(key, lockoutEnd.toString(), { EX: durationSec });

    console.log(`🔒 User ${userId} locked out for ${action} (${durationSec}s)`);
  } catch (err) {
    console.error('Apply lockout error:', err);
  }
}

/**
 * Clear lockout for user
 * @param {string} userId - User ID
 * @param {string} action - Action type
 */
export async function clearLockout(userId, action = 'default') {
  try {
    const redis = await getRedis();
    const key = `lockout:${action}:${userId}`;
    await redis.del(key);

    console.log(`🔓 Lockout cleared for user ${userId} (${action})`);
  } catch (err) {
    console.error('Clear lockout error:', err);
  }
}
