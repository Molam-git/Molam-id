-- =============================================================================
-- MOLAM ID DATABASE SCHEMA
-- =============================================================================

-- Drop existing table if it exists (use with caution in production!)
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_picture_url VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Create a function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Insert a test user with password: 12345678
-- Password hash generated with bcrypt, rounds=12
INSERT INTO users (phone, email, password_hash, first_name, last_name, created_at, updated_at)
VALUES (
  '+221771234567',
  'molam@gmail.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBCOS',
  'Test',
  'User',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show all tables
\dt

-- Show users table structure
\d users

-- Show all users
SELECT id, phone, email, first_name, last_name, profile_picture_url, created_at FROM users;
