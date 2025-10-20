-- 02_migrations.sql (Molam ID essentials)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- verification codes (OTP, USSD) (store hashed)
CREATE TABLE IF NOT EXISTS molam_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  phone TEXT,
  email TEXT,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL,         -- 'sms','email','ussd'
  purpose TEXT NOT NULL,         -- 'signup','pw_reset','ussd_pin_setup'
  nonce TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- sessions (refresh tokens hashed)
CREATE TABLE IF NOT EXISTS molam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  device_id TEXT,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- kyc doc metadata (for future)
CREATE TABLE IF NOT EXISTS molam_kyc_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_key_id TEXT,
  content_hash TEXT NOT NULL,
  ocr_data JSONB,
  status TEXT DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- audit logs (append-only)
CREATE TABLE IF NOT EXISTS molam_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID,
  action TEXT NOT NULL,
  target_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
