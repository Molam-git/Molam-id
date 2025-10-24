-- ==============================================
-- Brique 6 — Password & PIN Reset (Molam ID, multi-pays)
-- Tables SQL complètes pour mot de passe et PIN USSD
-- ==============================================

-- ==============================================
-- Table utilisateurs
-- ==============================================
CREATE TABLE IF NOT EXISTS molam_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molam_id TEXT UNIQUE NOT NULL,                  -- ID unique utilisateur Molam
  phone_e164 TEXT UNIQUE,                         -- Numéro format E.164
  email TEXT UNIQUE,                              -- Email
  password_hash TEXT NOT NULL,                    -- Hash mot de passe
  ussd_pin_hash TEXT,                             -- Hash PIN USSD
  language TEXT DEFAULT 'en',                     -- Langue préférée
  currency TEXT DEFAULT 'USD',                    -- Devise
  country_code CHAR(2),                           -- ISO 3166-1 alpha-2
  zone_code TEXT,                                 -- Région / zone ex: SN-DKR
  is_verified BOOLEAN DEFAULT FALSE,             -- KYC vérifié ?
  kyc_level TEXT DEFAULT 'P0',                    -- Niveau KYC
  user_type TEXT DEFAULT 'customer',             -- 'customer','merchant','employee'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================
-- Table des requêtes de reset (OTP multi-pays)
-- ==============================================
CREATE TABLE IF NOT EXISTS molam_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id),
  channel TEXT NOT NULL,                         -- 'email' | 'sms'
  kind TEXT NOT NULL,                            -- 'password' | 'ussd_pin'
  otp_hash TEXT NOT NULL,                        -- Hash OTP (Argon2id + pepper)
  otp_expires_at TIMESTAMP NOT NULL,             -- Expiration OTP
  attempts INT DEFAULT 0,                         -- Tentatives déjà effectuées
  max_attempts INT DEFAULT 3,                     -- Limite tentatives
  link_jwt_id TEXT,                              -- JWT pour lien sécurisé (optionnel)
  link_expires_at TIMESTAMP,                     -- Expiration lien JWT
  country_code CHAR(2),                          -- Pays utilisateur
  status TEXT DEFAULT 'pending',                 -- 'pending','verified','consumed','expired'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================
-- Table audit immuable
-- ==============================================
CREATE TABLE IF NOT EXISTS molam_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,                             -- L'utilisateur qui a fait l'action
  target_user_id UUID,                            -- L'utilisateur ciblé par l'action
  action TEXT NOT NULL,                           -- Type d'action (ex: PASSWORD_RESET_REQUEST)
  module TEXT DEFAULT 'id',                       -- Module concerné
  ip INET,                                        -- IP de l'acteur
  user_agent TEXT,                                -- User agent
  correlation_id TEXT,                            -- Pour tracer les requêtes multi-services
  metadata JSONB,                                 -- Infos supplémentaires (ex: country, channel)
  country_code CHAR(2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==============================================
-- Indexes recommandés pour performance
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON molam_users(phone_e164);
CREATE INDEX IF NOT EXISTS idx_users_email ON molam_users(email);
CREATE INDEX IF NOT EXISTS idx_reset_user_id ON molam_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_status ON molam_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_target ON molam_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON molam_audit_logs(actor_user_id);

-- ==============================================
-- Exemples de contraintes additionnelles (optionnel)
-- ==============================================
-- Vérifier que channel est bien 'sms' ou 'email'
ALTER TABLE molam_reset_requests
ADD CONSTRAINT chk_channel CHECK (channel IN ('sms','email'));

-- Vérifier que kind est 'password' ou 'ussd_pin'
ALTER TABLE molam_reset_requests
ADD CONSTRAINT chk_kind CHECK (kind IN ('password','ussd_pin'));
