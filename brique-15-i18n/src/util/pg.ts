// PostgreSQL connection utility

import { Pool } from "pg";
import { config } from "../i18n/config";

export const pool = new Pool({
  connectionString: config.database.url,
  ...config.database.pool,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
});
