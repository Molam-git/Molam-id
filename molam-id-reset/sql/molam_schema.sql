-- ==========================================================
--  Molam Database Schema
--  All tables in a single SQL file
-- ==========================================================
--CREATE SCHEMA IF NOT EXISTS password_reset;
-- 1. Table: molam_users
CREATE TABLE IF NOT EXISTS molam_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    molam_id TEXT NOT NULL UNIQUE,          -- Public human-readable ID
    phone_e164 TEXT UNIQUE,
    email CITEXT UNIQUE,
    password_hash TEXT,
    ussd_pin_hash TEXT,
    language TEXT DEFAULT 'en',
    country_code TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Table: molam_reset_requests
CREATE TABLE IF NOT EXISTS molam_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES molam_users(id),
    kind TEXT NOT NULL,       -- 'password' or 'ussd_pin'
    channel TEXT NOT NULL,    -- 'email', 'sms', 'ussd'
    otp_hash TEXT NOT NULL,
    otp_expires_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending',   -- 'pending', 'verified', 'consumed'
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    country_code TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Table: molam_sessions
CREATE TABLE IF NOT EXISTS molam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES molam_users(id),
    channel TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Table: molam_audit_logs
CREATE TABLE IF NOT EXISTS molam_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    target_user_id UUID REFERENCES molam_users(id),
    action TEXT NOT NULL,
    module TEXT,
    metadata JSONB,
    country_code TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Optional: indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON molam_users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON molam_users(phone_e164);
CREATE INDEX IF NOT EXISTS idx_reset_requests_user_id ON molam_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON molam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON molam_audit_logs(target_user_id);
