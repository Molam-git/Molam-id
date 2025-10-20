import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.PG_URL,
});

// Optional helper to query
export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}
