/**
 * Redis Client for Caching
 */

import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on("error", (err) => {
    console.error("Redis client error:", err);
  });

  redisClient.on("connect", () => {
    console.log("Redis client connected");
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Get Redis client
 */
export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call initRedis() first.");
  }
  return redisClient;
}

/**
 * Cache user preferences
 */
export async function cacheUserPreferences(
  userId: string,
  prefs: any
): Promise<void> {
  const redis = getRedis();
  const key = `user:${userId}:prefs`;
  await redis.setEx(key, 3600, JSON.stringify(prefs)); // 1 hour TTL
}

/**
 * Get cached user preferences
 */
export async function getCachedUserPreferences(
  userId: string
): Promise<any | null> {
  const redis = getRedis();
  const key = `user:${userId}:prefs`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Invalidate user preferences cache
 */
export async function invalidateUserPreferencesCache(
  userId: string
): Promise<void> {
  const redis = getRedis();
  const key = `user:${userId}:prefs`;
  await redis.del(key);
}

/**
 * Cache user contacts
 */
export async function cacheUserContacts(
  userId: string,
  contacts: any[]
): Promise<void> {
  const redis = getRedis();
  const key = `user:${userId}:contacts`;
  await redis.setEx(key, 1800, JSON.stringify(contacts)); // 30 minutes TTL
}

/**
 * Get cached user contacts
 */
export async function getCachedUserContacts(
  userId: string
): Promise<any[] | null> {
  const redis = getRedis();
  const key = `user:${userId}:contacts`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Invalidate user contacts cache
 */
export async function invalidateUserContactsCache(
  userId: string
): Promise<void> {
  const redis = getRedis();
  const key = `user:${userId}:contacts`;
  await redis.del(key);
}

/**
 * Health check
 */
export async function healthCheckRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
