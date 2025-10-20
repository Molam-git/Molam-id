CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE molam_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molam_id TEXT NOT NULL UNIQUE,
  phone_e164 TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  ussd_pin_hash TEXT,
  role_profile TEXT[] NOT NULL DEFAULT ARRAY['client']::text[],
  status TEXT NOT NULL DEFAULT 'pending',
  lang_pref TEXT NOT NULL DEFAULT 'fr',
  currency_pref TEXT NOT NULL DEFAULT 'XOF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_molam_users_phone ON molam_users (phone_e164);
CREATE INDEX idx_molam_users_status ON molam_users (status);
