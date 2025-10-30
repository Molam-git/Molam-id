/**
 * Molam ID - Database Connection Pool
 */
import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function initPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'molam_id',
      user: process.env.PGUSER || 'molam',
      password: process.env.PGPASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return pool;
}

/**
 * Get the connection pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const p = getPool();
  return p.query(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const p = getPool();
  return p.connect();
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { pool };
