/**
 * Database connection pool for AuthZ service
 * Connects to PostgreSQL with optimized pooling configuration
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create connection pool with optimized settings for AuthZ
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'molam_id',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',

  // Performance tuning for AuthZ (high throughput, low latency)
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect

  // Statement timeout for safety (prevent long-running queries)
  statement_timeout: 5000, // 5 seconds max per query
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Test connection on startup
pool.on('connect', (client) => {
  console.log('New PostgreSQL client connected to authz-api pool');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing PostgreSQL pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing PostgreSQL pool...');
  await pool.end();
  process.exit(0);
});

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

export default pool;
