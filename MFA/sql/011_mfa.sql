-- Brique 11 - Authentification Multi-Facteurs Industrielle
CREATE TYPE mfa_factor AS ENUM ('sms_otp','email_otp','totp','webauthn','recovery_code','push','ussd_pin');

CREATE TABLE IF NOT EXISTS molam_mfa_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  factor_type mfa_factor NOT NULL,
  label TEXT,
  secret_enc BYTEA,
  public_data JSONB,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON molam_mfa_factors(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_type ON molam_mfa_factors(factor_type);

CREATE TABLE IF NOT EXISTS molam_mfa_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  factor_id UUID REFERENCES molam_mfa_factors(id) ON DELETE CASCADE,
  channel TEXT,
  code_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT DEFAULT 0,
  max_attempts SMALLINT DEFAULT 5,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otps_user_expires ON molam_mfa_otps(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_used ON molam_mfa_otps(used_at);

CREATE TABLE IF NOT EXISTS molam_mfa_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  factor_id UUID REFERENCES molam_mfa_factors(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  sign_count BIGINT DEFAULT 0,
  transports TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, credential_id)
);

CREATE TABLE IF NOT EXISTS molam_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash BYTEA NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON molam_mfa_recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS molam_mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  rule JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_scope ON molam_mfa_policies(scope);

CREATE TABLE IF NOT EXISTS molam_ussd_pins (
  user_id UUID PRIMARY KEY,
  pin_hash BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count SMALLINT DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS molam_mfa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  factor_type mfa_factor,
  event_type TEXT,
  detail JSONB,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_events_user ON molam_mfa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_events_created ON molam_mfa_events(created_at);