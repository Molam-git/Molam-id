-- 007_biometrics_core.sql
-- Brique 7: Biometrics (Fingerprint, Face ID, Passkeys/WebAuthn)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Devices table (tracks user devices with biometric capabilities)
CREATE TABLE IF NOT EXISTS molam_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  device_label TEXT,
  platform TEXT CHECK (platform IN ('web','ios','android','harmony','desktop')),
  os_version TEXT,
  app_version TEXT,
  device_fingerprint TEXT,              -- SHA-256 hash of stable device properties
  attested BOOLEAN DEFAULT FALSE,       -- Whether device passed attestation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_molam_devices_user ON molam_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_devices_last_seen ON molam_devices(last_seen_at);

-- WebAuthn credentials table (stores public keys, never biometric templates)
CREATE TABLE IF NOT EXISTS molam_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  device_id UUID REFERENCES molam_devices(id) ON DELETE SET NULL,
  credential_id BYTEA UNIQUE NOT NULL,  -- Base64url decoded credential ID
  public_key BYTEA NOT NULL,            -- COSE-encoded public key
  sign_count BIGINT DEFAULT 0,          -- Counter for replay detection
  transports TEXT[],                    -- ['internal','usb','nfc','ble','hybrid']
  aaguid UUID,                          -- Authenticator AAGUID
  attestation_format TEXT,              -- 'packed','fido-u2f','apple','android-safetynet','none'
  attestation_trust_path JSONB,         -- Certificate chain or metadata (optional)
  backup_eligible BOOLEAN DEFAULT FALSE,
  backup_state BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON molam_webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential ON molam_webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_device ON molam_webauthn_credentials(device_id);

-- Biometric preferences (user-configurable settings)
CREATE TABLE IF NOT EXISTS molam_biometric_prefs (
  user_id UUID PRIMARY KEY,
  biometrics_enabled BOOLEAN DEFAULT FALSE,
  require_biometric_for_sensitive BOOLEAN DEFAULT TRUE,
  step_up_threshold NUMERIC(10,2) DEFAULT 50000, -- Threshold in local currency (interpreted via user.currency)
  country_code CHAR(2),                          -- ISO 3166-1 alpha-2
  currency TEXT DEFAULT 'XOF',                   -- User's currency
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_prefs_enabled ON molam_biometric_prefs(biometrics_enabled);

-- Authentication events (immutable audit log)
CREATE TABLE IF NOT EXISTS molam_auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  device_id UUID,
  event_type TEXT NOT NULL,     -- 'enroll_begin','enroll_finish','assert_begin','assert_success','assert_fail','prefs_update','credential_revoked'
  ip INET,
  user_agent TEXT,
  geo_country CHAR(2),           -- Detected from X-Geo-Country header or IP
  detail JSONB,                  -- Additional context (errors, metadata, etc.)
  correlation_id TEXT,           -- For request tracing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user ON molam_auth_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON molam_auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_created ON molam_auth_events(created_at);

-- WebAuthn challenges (temporary storage for anti-replay)
-- Note: In production, use Redis instead for TTL and performance
-- This table is for fallback/persistence only
CREATE TABLE IF NOT EXISTS molam_webauthn_challenges (
  challenge_key TEXT PRIMARY KEY,       -- Format: "webauthn:{type}:{user_id}"
  challenge TEXT NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_expires ON molam_webauthn_challenges(expires_at);

-- Cleanup expired challenges (run periodically)
-- In production, Redis handles this automatically with TTL
CREATE OR REPLACE FUNCTION cleanup_expired_challenges() RETURNS void AS $$
BEGIN
  DELETE FROM molam_webauthn_challenges WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Add columns to existing molam_users table if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='biometric_enabled') THEN
    ALTER TABLE molam_users ADD COLUMN biometric_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='step_up_at') THEN
    ALTER TABLE molam_users ADD COLUMN step_up_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE molam_devices IS 'User devices with biometric capabilities (never stores biometric templates)';
COMMENT ON TABLE molam_webauthn_credentials IS 'WebAuthn public keys and attestation data (FIDO2/Passkeys)';
COMMENT ON TABLE molam_biometric_prefs IS 'User preferences for biometric authentication';
COMMENT ON TABLE molam_auth_events IS 'Immutable audit log for all authentication events';
COMMENT ON COLUMN molam_webauthn_credentials.credential_id IS 'Unique credential identifier (base64url decoded)';
COMMENT ON COLUMN molam_webauthn_credentials.public_key IS 'COSE-encoded public key (never stores private keys)';
COMMENT ON COLUMN molam_webauthn_credentials.sign_count IS 'Signature counter for clone detection';
COMMENT ON COLUMN molam_biometric_prefs.step_up_threshold IS 'Amount threshold requiring step-up auth (in user currency)';
