-- Migration Brique 4 : Onboarding & KYC

-- 1. Ajout de colonnes à molam_users
ALTER TABLE molam_users
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS is_kyc_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_level TEXT DEFAULT 'P0',
  ADD COLUMN IF NOT EXISTS kyc_provider TEXT,
  ADD COLUMN IF NOT EXISTS kyc_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS ussd_pin_hash TEXT;

-- Index sur les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_users_user_type ON molam_users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_kyc_level ON molam_users(kyc_level);

-- 2. Mise à jour de la table molam_kyc_docs (si elle existe déjà)
DROP TABLE IF EXISTS molam_kyc_docs CASCADE;
CREATE TABLE molam_kyc_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_key_id TEXT,
  content_hash TEXT NOT NULL,
  ocr_data JSONB,
  status TEXT DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_kyc_docs_user ON molam_kyc_docs(user_id);
CREATE INDEX idx_kyc_docs_status ON molam_kyc_docs(status);

-- 3. Mise à jour de la table molam_verification_codes
DROP TABLE IF EXISTS molam_verification_codes CASCADE;
CREATE TABLE molam_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL,
  nonce TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_verification_phone ON molam_verification_codes(phone);
CREATE INDEX idx_verification_email ON molam_verification_codes(email);
CREATE INDEX idx_verification_expires ON molam_verification_codes(expires_at);

-- 4. Mise à jour de la table molam_sessions
ALTER TABLE molam_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_sessions_device ON molam_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON molam_sessions(expires_at);

-- 5. Mise à jour de molam_roles
ALTER TABLE molam_roles
  ADD COLUMN IF NOT EXISTS granted_by INTEGER REFERENCES molam_users(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 6. Table de rate limiting (alternative à Redis pour démarrer)
CREATE TABLE IF NOT EXISTS molam_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rate_limits_key ON molam_rate_limits(key, type);
CREATE INDEX idx_rate_limits_expires ON molam_rate_limits(expires_at);

-- 7. Table pour les webhooks reçus (replay protection)
CREATE TABLE IF NOT EXISTS molam_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_webhook_event_id ON molam_webhook_events(event_id);
CREATE INDEX idx_webhook_status ON molam_webhook_events(status);