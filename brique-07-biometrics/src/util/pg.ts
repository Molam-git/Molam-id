// src/util/pg.ts
import { Pool } from "pg";
import { config } from "../config/index.js";

export const pool = new Pool({
  connectionString: config.pg.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT NOW()");
    console.log("✓ PostgreSQL connected:", result.rows[0].now);
  } finally {
    client.release();
  }
}
