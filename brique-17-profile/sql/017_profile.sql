-- Brique 17: Profil utilisateur
-- Profils enrichis et unifiés pour tous les modules Molam

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS molam_profiles (
  user_id       UUID PRIMARY KEY,             -- REFERENCES molam_users(id) ON DELETE CASCADE
  display_name  TEXT,
  avatar_url    TEXT,                         -- URL signée temporaire (non stock public)
  avatar_obj_key TEXT,                        -- chemin objet S3/MinIO
  badges        TEXT[] DEFAULT '{}',          -- ex: ['kyc_verified','merchant_pro','employee','agent']
  preferences   JSONB DEFAULT '{}'::jsonb,    -- ex: {"theme":"dark","notify_email":true,"locale":"fr-SN"}
  country_code  CHAR(3),                      -- 'SEN','USA','FRA'
  bio           TEXT,                         -- description courte
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des changements de profil
CREATE TABLE IF NOT EXISTS molam_profile_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,               -- REFERENCES molam_users(id) ON DELETE CASCADE
  event_type    TEXT NOT NULL,               -- 'update_name','update_avatar','add_badge','remove_badge'
  detail        JSONB,
  actor_id      UUID,                        -- qui a fait l'action (self ou admin)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_profile_badges ON molam_profiles USING gin (badges);
CREATE INDEX IF NOT EXISTS idx_profile_country ON molam_profiles(country_code);
CREATE INDEX IF NOT EXISTS idx_profile_events_user ON molam_profile_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_events_type ON molam_profile_events(event_type, created_at DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER trigger_profile_updated
  BEFORE UPDATE ON molam_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_timestamp();

-- Fonction: obtenir badges d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_badges(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT badges INTO result
  FROM molam_profiles
  WHERE user_id = p_user_id;

  RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction: vérifier si utilisateur a un badge
CREATE OR REPLACE FUNCTION has_badge(p_user_id UUID, p_badge TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_badges TEXT[];
BEGIN
  user_badges := get_user_badges(p_user_id);
  RETURN p_badge = ANY(user_badges);
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaires
COMMENT ON TABLE molam_profiles IS 'Profils utilisateurs enrichis pour tous les modules Molam';
COMMENT ON TABLE molam_profile_events IS 'Historique des modifications de profil (audit trail)';
COMMENT ON COLUMN molam_profiles.badges IS 'Badges visibles: kyc_verified, merchant_pro, employee, agent, partner_bank';
COMMENT ON COLUMN molam_profiles.preferences IS 'Préférences JSON: theme, notifications, locale, accessibility';
COMMENT ON FUNCTION get_user_badges(UUID) IS 'Obtenir la liste des badges d''un utilisateur';
COMMENT ON FUNCTION has_badge(UUID, TEXT) IS 'Vérifier si un utilisateur possède un badge spécifique';
