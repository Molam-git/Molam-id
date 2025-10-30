/**
 * PostgreSQL Connection Pool
 */

import { Pool, PoolClient, QueryResult } from "pg";

let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function initPg(): Pool {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client", err);
  });

  pool.on("connect", () => {
    console.log("PostgreSQL client connected");
  });

  return pool;
}

/**
 * Get the database pool
 */
export function getDb(): Pool {
  if (!pool) {
    return initPg();
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult> {
  const db = getDb();
  return db.query(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const db = getDb();
  return db.connect();
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 */
export async function closePg(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query("SELECT 1 as health");
    return result.rows[0]?.health === 1;
  } catch (error) {
    console.error("PostgreSQL health check failed:", error);
    return false;
  }
}
