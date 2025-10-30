// PostgreSQL connection utility

import { Pool } from "pg";
import { config } from "../audit/config";

export const pool = new Pool({
  connectionString: config.database.url,
  ...config.database.pool,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}
