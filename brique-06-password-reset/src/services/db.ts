// src/services/db.ts
import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connected:', result.rows[0].now);
  } finally {
    client.release();
  }
}
