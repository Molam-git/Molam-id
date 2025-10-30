-- 011_mfa.sql
-- Brique 11: 2FA/MFA Unifié

CREATE TYPE mfa_factor AS ENUM ('sms_otp','email_otp','totp','webauthn','recovery_code','push','ussd_pin');

-- Facteurs MFA enregistrés par utilisateur
CREATE TABLE IF NOT EXISTS molam_mfa_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  factor_type mfa_factor NOT NULL,
  label TEXT,
  secret_enc BYTEA,
  public_data JSONB,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mfa_user ON molam_mfa_factors(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_type ON molam_mfa_factors(factor_type);

-- OTPs temporaires (SMS/Email)
CREATE TABLE IF NOT EXISTS molam_mfa_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  factor_id UUID REFERENCES molam_mfa_factors(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  code_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT DEFAULT 0,
  max_attempts SMALLINT DEFAULT 5,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_user_expires ON molam_mfa_otps(user_id, expires_at);

-- WebAuthn credentials (FIDO2)
CREATE TABLE IF NOT EXISTS molam_mfa_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  factor_id UUID REFERENCES molam_mfa_factors(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  sign_count BIGINT DEFAULT 0,
  transports TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON molam_mfa_webauthn_credentials(user_id);

-- Codes de secours (one-time recovery codes)
CREATE TABLE IF NOT EXISTS molam_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  code_hash BYTEA NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON molam_mfa_recovery_codes(user_id);

-- Politiques MFA par scope/resource
CREATE TABLE IF NOT EXISTS molam_mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL UNIQUE,
  rule JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USSD PINs (4-6 chiffres)
CREATE TABLE IF NOT EXISTS molam_ussd_pins (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id) ON DELETE CASCADE,
  pin_hash BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  retry_count SMALLINT DEFAULT 0,
  locked_until TIMESTAMPTZ
);

-- Audit immuable des événements MFA
CREATE TABLE IF NOT EXISTS molam_mfa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  factor_type mfa_factor,
  event_type TEXT NOT NULL,
  factor_id UUID,
  success BOOLEAN DEFAULT false,
  detail JSONB,
  metadata JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_events_user ON molam_mfa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_events_type ON molam_mfa_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mfa_events_created ON molam_mfa_events(created_at);

-- Politiques par défaut
INSERT INTO molam_mfa_policies (scope, rule) VALUES
('login', '{"min_factors": 1, "allowed_types": ["sms_otp", "email_otp", "totp", "webauthn", "ussd_pin"]}'),
('pay.transfer', '{"min_factors": 1, "required_for_amount": {"XOF": 50000, "USD": 100}, "preferred": ["totp", "webauthn"]}'),
('admin.dashboard', '{"min_factors": 2, "require_webauthn_for_roles": ["super_admin", "admin"], "allowed_types": ["totp", "webauthn"]}')
ON CONFLICT (scope) DO NOTHING;
