-- =====================================================
-- Molam ID — Brique 2 : Tables de support et Auth de base
-- =====================================================
-- Auteur : Malang Coulibaly
-- Date : 2025-10-19
-- =====================================================

-- 1️⃣ Table des rôles et permissions
CREATE TABLE IF NOT EXISTS molam_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,                      -- ex: id, pay, shop, eat, ads
  role TEXT NOT NULL,                        -- ex: client, merchant, admin
  scope JSONB DEFAULT '{}'::jsonb,           -- détails fins d’autorisation
  trusted_level INTEGER DEFAULT 0,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_molam_roles_user ON molam_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_roles_module ON molam_roles(module);

-- 2️⃣ Méthodes d’authentification
CREATE TABLE IF NOT EXISTS molam_user_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL,                 -- password, otp, oauth, webauthn
  provider TEXT,                           -- google, apple, sms, etc.
  credential_id TEXT,                      -- identifiant externe ou clé publique
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  device_info JSONB,
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_molam_user_auth_user ON molam_user_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_user_auth_type ON molam_user_auth(auth_type);

-- 3️⃣ Sessions utilisateurs (refresh tokens)
CREATE TABLE IF NOT EXISTS molam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  device_id TEXT,
  refresh_token_hash TEXT NOT NULL,          -- hashé avec SHA-256
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_molam_sessions_user ON molam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_sessions_expires ON molam_sessions(expires_at);

-- 4️⃣ Tokens révoqués
CREATE TABLE IF NOT EXISTS molam_revoked_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_token_hash TEXT NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_hash ON molam_revoked_tokens(refresh_token_hash);

-- 5️⃣ Audit logs (journalisation immuable)
CREATE TABLE IF NOT EXISTS molam_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID,                                  -- l’utilisateur ou le service à l’origine
  action TEXT NOT NULL,                        -- ex: signup, login, logout, refresh
  target_id UUID,                              -- objet concerné
  meta JSONB,                                  -- informations additionnelles
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON molam_audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON molam_audit_logs(action);

-- 6️⃣ Documents KYC
CREATE TABLE IF NOT EXISTS molam_kyc_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,                     -- ex: ID_CARD, PASSPORT, SELFIE
  storage_path TEXT NOT NULL,                 -- chemin (S3, MinIO, etc.)
  storage_key_id TEXT,
  content_hash TEXT NOT NULL,                 -- hash SHA256 du fichier
  ocr_data JSONB,                             -- données OCR optionnelles
  status TEXT DEFAULT 'pending',              -- pending, verified, rejected
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_user ON molam_kyc_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON molam_kyc_docs(status);

-- 7️⃣ Codes de vérification (OTP, USSD, email)
CREATE TABLE IF NOT EXISTS molam_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  code_hash TEXT NOT NULL,                    -- Argon2id hash du code
  channel TEXT NOT NULL,                      -- sms, email, ussd
  purpose TEXT NOT NULL,                      -- signup, reset, verify
  nonce TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_codes_user ON molam_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_codes_purpose ON molam_verification_codes(purpose);
CREATE INDEX IF NOT EXISTS idx_codes_expires ON molam_verification_codes(expires_at);
