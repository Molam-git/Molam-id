// Redis client for caching delegations
import { createClient } from "redis";
import { config } from "../delegation/config";

const client = createClient({
  url: config.redis.url,
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

client.on("connect", () => {
  console.log("✅ Redis connected");
});

// Connect on module load
client.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
});

export { client as redis };

/**
 * Get cached delegation
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const value = await client.get(key);
  if (!value) return null;
  return JSON.parse(value);
}

/**
 * Cache delegation
 */
export async function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const ttl = ttlSeconds || config.redis.ttl;
  await client.setEx(key, ttl, JSON.stringify(value));
}

/**
 * Delete cached delegation
 */
export async function delCached(key: string): Promise<void> {
  await client.del(key);
}

/**
 * Invalidate all delegations for a user
 */
export async function invalidateUserDelegations(userId: string): Promise<void> {
  const pattern = `delegation:user:${userId}:*`;
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
}
