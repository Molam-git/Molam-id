// Redis client for caching and rate limiting
import { createClient } from "redis";
import { config } from "../config";

export const redis = createClient({ url: config.redis.url });

redis.on("error", (err) => console.error("Redis error:", err));

// Connect on module load
redis.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  process.exit(1);
});

/**
 * Rate limiting: check if user/IP has exceeded limit
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  const remaining = Math.max(0, maxRequests - count);
  return {
    allowed: count <= maxRequests,
    remaining,
  };
}

/**
 * Store nonce/challenge for anti-replay
 */
export async function storeNonce(nonce: string, ttlSec: number): Promise<void> {
  await redis.setEx(`voice_nonce:${nonce}`, ttlSec, "1");
}

/**
 * Check if nonce was already used
 */
export async function checkNonce(nonce: string): Promise<boolean> {
  const exists = await redis.exists(`voice_nonce:${nonce}`);
  return exists === 1;
}
