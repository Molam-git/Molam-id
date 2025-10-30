-- =====================================================================
-- Molam ID — Brique 24: SDK Auth (JS, iOS, Android)
-- Migration: 024_sdk_auth.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table for SDK client registrations
CREATE TABLE IF NOT EXISTS molam_sdk_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('js','ios','android','node','react','flutter')),
  api_key TEXT UNIQUE NOT NULL,
  secret_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('development','staging','production')),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sdk_clients_api_key ON molam_sdk_clients(api_key);
CREATE INDEX idx_sdk_clients_platform ON molam_sdk_clients(platform);

-- Table for refresh tokens (linked to sessions)
CREATE TABLE IF NOT EXISTS molam_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES molam_sessions_active(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL
);

CREATE INDEX idx_refresh_user ON molam_refresh_tokens(user_id, expires_at);
CREATE INDEX idx_refresh_session ON molam_refresh_tokens(session_id);
CREATE INDEX idx_refresh_device ON molam_refresh_tokens(device_id);
CREATE INDEX idx_refresh_active ON molam_refresh_tokens(user_id) WHERE revoked_at IS NULL AND expires_at > NOW();

-- Function to clean expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM molam_refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

-- Function to revoke all user tokens
CREATE OR REPLACE FUNCTION revoke_user_tokens(p_user_id UUID, p_reason TEXT DEFAULT 'user_logout')
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE molam_refresh_tokens
  SET revoked_at = NOW(), revoked_reason = p_reason
  WHERE user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END $$;

-- View for active tokens
CREATE OR REPLACE VIEW v_active_refresh_tokens AS
SELECT
  rt.id,
  rt.user_id,
  u.email,
  rt.session_id,
  rt.device_id,
  rt.created_at,
  rt.expires_at,
  EXTRACT(EPOCH FROM (rt.expires_at - NOW())) AS seconds_until_expiry
FROM molam_refresh_tokens rt
JOIN molam_users u ON u.id = rt.user_id
WHERE rt.revoked_at IS NULL AND rt.expires_at > NOW();

COMMENT ON TABLE molam_sdk_clients IS 'SDK client registrations for authentication';
COMMENT ON TABLE molam_refresh_tokens IS 'Refresh tokens for token rotation and session management';
