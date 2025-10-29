-- 029_user_profile.sql

-- Base profile (extends molam_users)
CREATE TABLE IF NOT EXISTS molam_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  country_code CHAR(2),
  city TEXT,
  avatar_key TEXT,
  avatar_etag TEXT,
  banner_key TEXT,
  banner_etag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media assets registry (owner-scoped)
CREATE TABLE IF NOT EXISTS molam_media_assets (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('avatar','banner','doc','other')),
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT,
  status TEXT NOT NULL CHECK (status IN ('uploaded','processing','ready','rejected')),
  variants JSONB,
  moderation JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_owner ON molam_media_assets(owner_id);

-- Badges catalog (managed per subsidiary/module owner)
CREATE TABLE IF NOT EXISTS molam_badges (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_key TEXT,
  owner_module TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES molam_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badge assignments to users
CREATE TABLE IF NOT EXISTS molam_user_badges (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  badge_id BIGINT NOT NULL REFERENCES molam_badges(id) ON DELETE RESTRICT,
  granted_by UUID REFERENCES molam_users(id),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to   TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id, valid_from)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON molam_user_badges(user_id);

-- Public activity feed (privacy-safe)
CREATE TABLE IF NOT EXISTS molam_user_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  ref_id TEXT,
  metadata JSONB,
  ip INET,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_user_ts ON molam_user_activity(user_id, created_at DESC);

-- Privacy settings
CREATE TABLE IF NOT EXISTS molam_user_privacy (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id) ON DELETE CASCADE,
  show_badges BOOLEAN NOT NULL DEFAULT TRUE,
  show_activity BOOLEAN NOT NULL DEFAULT FALSE,
  show_country BOOLEAN NOT NULL DEFAULT TRUE,
  show_display_name BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trigger
CREATE OR REPLACE FUNCTION trg_touch_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_upd_profile ON molam_user_profiles;
CREATE TRIGGER t_upd_profile BEFORE UPDATE ON molam_user_profiles
FOR EACH ROW EXECUTE PROCEDURE trg_touch_profile_updated_at();