
CREATE TABLE molam_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molam_id TEXT NOT NULL UNIQUE,                      -- Public, human-readable, immutable (ex: MOLAM-SN-00000123)
  phone_e164 TEXT UNIQUE,                             -- Normalized phone in E.164 (+221...)
  email TEXT UNIQUE,                                -- Email (case-insensitive)
  password_hash TEXT,                                 -- Argon2id hash
  ussd_pin_hash TEXT,                                 -- USSD PIN hash (never plaintext)
  role_profile TEXT[] NOT NULL DEFAULT ARRAY['client']::text[], -- Roles array (client, agent, merchant, admin, etc.)
  status TEXT NOT NULL DEFAULT 'pending',             -- pending, active, suspended, closed
  lang_pref TEXT NOT NULL DEFAULT 'en',               -- Language preference
  currency_pref TEXT NOT NULL DEFAULT 'USD',          -- Currency preference
  kyc_status TEXT NOT NULL DEFAULT 'none',            -- none, initiated, verified, rejected
  kyc_reference TEXT,                                 -- External KYC system reference
  metadata JSONB DEFAULT '{}'::jsonb,                 -- Extensible metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_molam_users_phone ON molam_users (phone_e164);
CREATE INDEX idx_molam_users_status ON molam_users (status);
