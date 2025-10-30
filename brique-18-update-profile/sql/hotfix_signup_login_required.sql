-- ============================================================================
-- Hotfix: Enforce Signup/Login Requirements
-- ============================================================================
-- Description: Ensure all accounts have password + at least one identifier
-- Rollout: Use NOT VALID constraints for gradual enforcement
-- Feature Flag: ENFORCE_IDENTITY_STRICT
-- ============================================================================

-- Add auth_mode column (if not exists)
ALTER TABLE molam_users
  ADD COLUMN IF NOT EXISTS auth_mode TEXT DEFAULT 'password';

COMMENT ON COLUMN molam_users.auth_mode IS 'Authentication mode: password, biometric, voice, oauth';

-- ============================================================================
-- Constraint 1: At least one primary identifier (email OR phone_e164)
-- ============================================================================

ALTER TABLE molam_users
  DROP CONSTRAINT IF EXISTS chk_user_primary_identifier;

ALTER TABLE molam_users
  ADD CONSTRAINT chk_user_primary_identifier
  CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL) NOT VALID;

COMMENT ON CONSTRAINT chk_user_primary_identifier ON molam_users IS
  'Ensure at least email or phone_e164 is present';

-- ============================================================================
-- Constraint 2: Password required for password-based auth
-- ============================================================================

ALTER TABLE molam_users
  DROP CONSTRAINT IF EXISTS chk_user_password_required;

ALTER TABLE molam_users
  ADD CONSTRAINT chk_user_password_required
  CHECK (auth_mode <> 'password' OR password_hash IS NOT NULL) NOT VALID;

COMMENT ON CONSTRAINT chk_user_password_required ON molam_users IS
  'Password required for accounts with auth_mode=password';

-- ============================================================================
-- Migration Helper: Find Non-Compliant Accounts
-- ============================================================================

CREATE OR REPLACE FUNCTION find_non_compliant_accounts()
RETURNS TABLE (
  user_id UUID,
  molam_id TEXT,
  issue TEXT
) AS $$
BEGIN
  -- Missing primary identifier
  RETURN QUERY
  SELECT
    id,
    molam_id,
    'Missing email and phone_e164'::TEXT
  FROM molam_users
  WHERE email IS NULL AND phone_e164 IS NULL;

  -- Missing password for password auth
  RETURN QUERY
  SELECT
    id,
    molam_id,
    'Missing password_hash for auth_mode=password'::TEXT
  FROM molam_users
  WHERE auth_mode = 'password' AND password_hash IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Migration Helper: Auto-fix accounts (conservative)
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_fix_accounts()
RETURNS TABLE (
  fixed_count INT,
  details TEXT
) AS $$
DECLARE
  v_fixed INT := 0;
BEGIN
  -- Set auth_mode to 'biometric' if no password but has biometric
  UPDATE molam_users u
  SET auth_mode = 'biometric'
  FROM molam_biometric_enrollments b
  WHERE u.id = b.user_id
    AND u.password_hash IS NULL
    AND u.auth_mode = 'password'
    AND b.status = 'active';

  GET DIAGNOSTICS v_fixed = ROW_COUNT;

  RETURN QUERY SELECT v_fixed, 'Users with biometric but no password fixed';

  -- Set auth_mode to 'voice' if no password but has voice
  UPDATE molam_users u
  SET auth_mode = 'voice'
  FROM molam_voice_enrollments v
  WHERE u.id = v.user_id
    AND u.password_hash IS NULL
    AND u.auth_mode = 'password'
    AND v.status = 'active';

  GET DIAGNOSTICS v_fixed = ROW_COUNT;

  RETURN QUERY SELECT v_fixed, 'Users with voice but no password fixed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Validation: Enable Constraints
-- ============================================================================

-- Run this AFTER fixing non-compliant accounts:
-- ALTER TABLE molam_users VALIDATE CONSTRAINT chk_user_primary_identifier;
-- ALTER TABLE molam_users VALIDATE CONSTRAINT chk_user_password_required;

-- ============================================================================
-- Feature Flag Support
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO molam_feature_flags (flag_name, enabled, config)
VALUES
  ('ENFORCE_IDENTITY_STRICT', false, '{"rollout_percentage": 0}'::jsonb)
ON CONFLICT (flag_name) DO NOTHING;

COMMENT ON TABLE molam_feature_flags IS 'Feature flags for gradual rollout';

-- Helper function: Check if feature is enabled
CREATE OR REPLACE FUNCTION is_feature_enabled(p_flag_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
  FROM molam_feature_flags
  WHERE flag_name = p_flag_name;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON molam_feature_flags TO molam_app;
