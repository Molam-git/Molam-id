/**
 * Molam ID - Database Connection Pool
 */
import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

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

export function getPool(): Pool {
  if (!pool) {
    return initPool();
  }
  return pool;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const p = getPool();
  return p.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  const p = getPool();
  return p.connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export { pool };
