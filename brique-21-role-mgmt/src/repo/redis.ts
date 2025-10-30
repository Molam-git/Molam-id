/**
 * Molam ID - Redis Client for Caching
 */
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Initialize Redis client
 */
export async function initRedis(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      console.log('Redis client disconnected');
      isConnected = false;
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedis(): RedisClientType {
  if (!redisClient || !isConnected) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Cache bust for user permissions
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`rbac:user:${userId}:perms`);
    await redis.del(`rbac:user:${userId}:roles`);
  } catch (err) {
    console.error('Failed to invalidate user cache:', err);
    // Don't throw - cache invalidation failures shouldn't break operations
  }
}

/**
 * Cache bust for role permissions
 */
export async function invalidateRoleCache(roleId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`rbac:role:${roleId}:perms`);
  } catch (err) {
    console.error('Failed to invalidate role cache:', err);
  }
}

export { redisClient };
