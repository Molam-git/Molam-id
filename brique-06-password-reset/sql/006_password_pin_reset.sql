-- 006_password_pin_reset.sql
-- Brique 6: Password reset + PIN USSD reset (multi-pays)

-- Reset requests table (OTP for password and PIN)
CREATE TABLE IF NOT EXISTS molam_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,               -- 'email' | 'sms' | 'ussd'
  kind TEXT NOT NULL,                  -- 'password' | 'ussd_pin'
  otp_hash TEXT NOT NULL,              -- Argon2id hash
  otp_expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  link_jwt_id TEXT,                    -- for password reset link (optional)
  link_expires_at TIMESTAMPTZ,
  country_code CHAR(2),                -- ISO 3166-1 alpha-2
  status TEXT DEFAULT 'pending',       -- 'pending','verified','consumed','expired','blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_user_kind ON molam_reset_requests(user_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_reset_created ON molam_reset_requests(created_at);

-- USSD short codes catalog (for operations & dashboards)
CREATE TABLE IF NOT EXISTS molam_ussd_codes (
  code TEXT PRIMARY KEY,               -- '*131#','*131*1#','*131*2#','*131*3#','*131*99#'
  label TEXT NOT NULL,
  route TEXT NOT NULL,                 -- 'menu','balance','topup','transfer','pin_reset'
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default USSD codes
INSERT INTO molam_ussd_codes (code, label, route, enabled) VALUES
('*131#', 'Menu principal Molam', 'menu', true),
('*131*1#', 'Consulter solde', 'balance', true),
('*131*2#', 'Recharger compte', 'topup', true),
('*131*3#', 'Transfert P2P', 'transfer', true),
('*131*99#', 'Réinitialiser PIN', 'pin_reset', true)
ON CONFLICT (code) DO NOTHING;

-- Add country_code and zone_code to molam_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='country_code') THEN
    ALTER TABLE molam_users ADD COLUMN country_code CHAR(2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='zone_code') THEN
    ALTER TABLE molam_users ADD COLUMN zone_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='language') THEN
    ALTER TABLE molam_users ADD COLUMN language TEXT DEFAULT 'en';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_users' AND column_name='currency') THEN
    ALTER TABLE molam_users ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;
END $$;

-- Add country_code to audit logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_audit_logs' AND column_name='country_code') THEN
    ALTER TABLE molam_audit_logs ADD COLUMN country_code CHAR(2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_audit_logs' AND column_name='correlation_id') THEN
    ALTER TABLE molam_audit_logs ADD COLUMN correlation_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_audit_logs' AND column_name='ip') THEN
    ALTER TABLE molam_audit_logs ADD COLUMN ip INET;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_audit_logs' AND column_name='user_agent') THEN
    ALTER TABLE molam_audit_logs ADD COLUMN user_agent TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='molam_audit_logs' AND column_name='target_user_id') THEN
    ALTER TABLE molam_audit_logs ADD COLUMN target_user_id UUID;
  END IF;
END $$;
