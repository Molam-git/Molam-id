// PostgreSQL connection pool
import { Pool } from "pg";
import { config } from "../config";

export const pool = new Pool({
  connectionString: config.pg.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

// Test connection on startup
pool.query("SELECT NOW()").catch((err) => {
  console.error("Failed to connect to PostgreSQL:", err);
  process.exit(1);
});
