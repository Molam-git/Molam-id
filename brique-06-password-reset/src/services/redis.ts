// src/services/redis.ts
import { createClient } from 'redis';
import { env } from '../config/env.js';

const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('✓ Redis connected'));

let isConnected = false;

export async function connectRedis() {
  if (!isConnected) {
    await redis.connect();
    isConnected = true;
  }
  return redis;
}

export { redis };
