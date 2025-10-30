import { createClient } from 'redis';
import { env } from '../config/env.js';

let redisClient = null;

export async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    await redisClient.connect();
    console.log('✅ Redis connected');
  }

  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

process.on('SIGINT', closeRedis);
process.on('SIGTERM', closeRedis);

export default getRedis;
