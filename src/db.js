import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

console.log("🔧 Configuration DB:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
});

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "molam",
  password: process.env.DB_PASSWORD || "molam_pass",
  database: process.env.DB_NAME || "molam",
});

// Test initial
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Test de connexion échoué:", err.message);
  } else {
    console.log("✅ Test de connexion réussi:", res.rows[0].now);
  }
});