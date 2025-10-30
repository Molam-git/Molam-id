/**
 * Cache Utilities for RBAC
 * Redis-based caching for permission checks
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
 * Cache user permissions
 */
export async function cachePermissions(
  userId: string,
  permissions: string[]
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `rbac:perms:${userId}`;
    await redis.setEx(key, 600, JSON.stringify(permissions)); // 10 min TTL
  } catch (error) {
    console.error("Cache permissions error:", error);
  }
}

/**
 * Get cached user permissions
 */
export async function getCachedPermissions(
  userId: string
): Promise<string[] | null> {
  try {
    const redis = getRedis();
    const key = `rbac:perms:${userId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Get cached permissions error:", error);
    return null;
  }
}

/**
 * Invalidate user permissions cache
 */
export async function invalidatePermissionsCache(
  userId: string
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `rbac:perms:${userId}`;
    await redis.del(key);
  } catch (error) {
    console.error("Invalidate permissions cache error:", error);
  }
}

/**
 * Cache role permissions (system-wide)
 */
export async function cacheRolePermissions(
  roleId: string,
  permissions: string[]
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `rbac:role:${roleId}:perms`;
    await redis.setEx(key, 3600, JSON.stringify(permissions)); // 1 hour TTL
  } catch (error) {
    console.error("Cache role permissions error:", error);
  }
}

/**
 * Get cached role permissions
 */
export async function getCachedRolePermissions(
  roleId: string
): Promise<string[] | null> {
  try {
    const redis = getRedis();
    const key = `rbac:role:${roleId}:perms`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Get cached role permissions error:", error);
    return null;
  }
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
