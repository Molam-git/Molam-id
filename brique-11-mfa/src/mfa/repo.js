import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from 'redis';
import { cfg } from './config.js';

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: cfg.pgUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// Redis client
let redisClient = null;

export async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: cfg.redisUrl });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    await redisClient.connect();
    console.log('✅ Redis connected');
  }

  return redisClient;
}

/**
 * Close all database connections gracefully
 */
export async function closeConnections() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }

  await pool.end();
  console.log('✅ Database connections closed');
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnections();
  process.exit(0);
});
