/**
 * Molam ID - Redis Client
 */
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnected = false;

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

    await redisClient.connect();
  }

  return redisClient;
}

export function getRedis(): RedisClientType {
  if (!redisClient || !isConnected) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
}

export { redisClient };
