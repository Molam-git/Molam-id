import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "molam",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

async function addUserProfileFields() {
  console.log("🔄 Adding user profile fields to molam_users table...\n");

  try {
    // Check if columns already exist
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'molam_users'
      AND column_name IN ('first_name', 'last_name', 'profile_photo_url');
    `;

    const existingColumns = await pool.query(checkQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);

    // Add first_name if it doesn't exist
    if (!existingColumnNames.includes('first_name')) {
      await pool.query(`
        ALTER TABLE molam_users
        ADD COLUMN first_name VARCHAR(100);
      `);
      console.log("✅ Added 'first_name' column");
    } else {
      console.log("ℹ️  'first_name' column already exists");
    }

    // Add last_name if it doesn't exist
    if (!existingColumnNames.includes('last_name')) {
      await pool.query(`
        ALTER TABLE molam_users
        ADD COLUMN last_name VARCHAR(100);
      `);
      console.log("✅ Added 'last_name' column");
    } else {
      console.log("ℹ️  'last_name' column already exists");
    }

    // Add profile_photo_url if it doesn't exist
    if (!existingColumnNames.includes('profile_photo_url')) {
      await pool.query(`
        ALTER TABLE molam_users
        ADD COLUMN profile_photo_url TEXT;
      `);
      console.log("✅ Added 'profile_photo_url' column");
    } else {
      console.log("ℹ️  'profile_photo_url' column already exists");
    }

    console.log("\n✅ User profile fields migration completed successfully!");
    console.log("\n📋 New fields available:");
    console.log("   - first_name: VARCHAR(100) - User's first name");
    console.log("   - last_name: VARCHAR(100) - User's last name");
    console.log("   - profile_photo_url: TEXT - URL to user's profile photo");

  } catch (error) {
    console.error("❌ Error adding user profile fields:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
addUserProfileFields().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
