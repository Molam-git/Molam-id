-- =====================================================
-- Brique 29: Profil utilisateur (photo, badges, historique)
-- =====================================================
-- Description:
--   Unified profile layer for all Molam users across all subsidiaries
--   - Profile data: display name, bio, location, avatar, banner
--   - Badges: Managed by subsidiary roles (Verified, Agent, Merchant Star, etc.)
--   - Activity history: Cross-module activity feed (privacy-aware)
--   - Media management: S3 storage with signed URLs, async post-processing
--   - Privacy settings: Who can see what
--   - GDPR-ready: Audit trail, deletion, rectification
--
-- Dependencies:
--   - brique-21-sira (molam_users, molam_roles, molam_permissions)
--   - brique-23-multi-subsidiary (subsidiary_id references)
--   - brique-27-i18n (language preferences)
--   - brique-28-multicurrency (currency preferences)
-- =====================================================

-- =====================================================
-- 1. USER PROFILES
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_user_profiles (
  profile_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Display info
  display_name       VARCHAR(100),
  bio                TEXT,
  country_code       CHAR(2),  -- ISO 3166-1 alpha-2
  city               VARCHAR(100),

  -- Media references (stored in S3)
  avatar_url         TEXT,      -- Signed URL or CDN URL
  banner_url         TEXT,      -- Cover/banner image
  avatar_asset_id    UUID,      -- FK to molam_media_assets
  banner_asset_id    UUID,      -- FK to molam_media_assets

  -- Preferences (references to other briques)
  preferred_language VARCHAR(5) DEFAULT 'en',  -- ISO 639-1, e.g., 'fr', 'en', 'wo'
  preferred_currency CHAR(3) DEFAULT 'XOF',    -- ISO 4217, e.g., 'XOF', 'USD'

  -- Visibility (default: public for most fields)
  visibility_level   VARCHAR(20) DEFAULT 'public' CHECK (visibility_level IN ('public', 'contacts', 'private')),

  -- Stats (cached)
  badge_count        INTEGER DEFAULT 0,
  activity_count     INTEGER DEFAULT 0,

  -- Metadata
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_display_name_length CHECK (char_length(display_name) >= 2)
);

CREATE INDEX idx_user_profiles_user_id ON molam_user_profiles(user_id);
CREATE INDEX idx_user_profiles_country ON molam_user_profiles(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX idx_user_profiles_visibility ON molam_user_profiles(visibility_level);

COMMENT ON TABLE molam_user_profiles IS 'Unified user profile data for all Molam users';
COMMENT ON COLUMN molam_user_profiles.visibility_level IS 'Default visibility for profile fields: public, contacts, private';

-- =====================================================
-- 2. MEDIA ASSETS (S3-compatible storage)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_media_assets (
  asset_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- S3 storage
  s3_bucket          VARCHAR(100) NOT NULL,
  s3_key             TEXT NOT NULL,
  s3_region          VARCHAR(50),

  -- File info
  file_name          VARCHAR(255) NOT NULL,
  file_size          BIGINT NOT NULL,  -- bytes
  mime_type          VARCHAR(100) NOT NULL,

  -- Media type
  media_type         VARCHAR(20) NOT NULL CHECK (media_type IN ('avatar', 'banner', 'attachment')),

  -- Processing status
  processing_status  VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error   TEXT,

  -- Variants (thumbnails, resized versions)
  variants           JSONB DEFAULT '{}',  -- { "thumbnail": { "s3_key": "...", "width": 150, "height": 150 }, ... }

  -- Moderation
  moderation_status  VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason  TEXT,
  moderated_by       UUID REFERENCES molam_users(user_id),
  moderated_at       TIMESTAMPTZ,

  -- Signed URL cache
  signed_url         TEXT,
  signed_url_expires_at TIMESTAMPTZ,

  -- Metadata
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,  -- Soft delete for GDPR

  -- Constraints
  CONSTRAINT uq_media_s3_location UNIQUE (s3_bucket, s3_key)
);

CREATE INDEX idx_media_assets_user_id ON molam_media_assets(user_id);
CREATE INDEX idx_media_assets_type ON molam_media_assets(media_type);
CREATE INDEX idx_media_assets_status ON molam_media_assets(processing_status);
CREATE INDEX idx_media_assets_moderation ON molam_media_assets(moderation_status);
CREATE INDEX idx_media_assets_deleted ON molam_media_assets(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE molam_media_assets IS 'S3-stored media assets with async post-processing and moderation';
COMMENT ON COLUMN molam_media_assets.variants IS 'JSON map of processed variants (thumbnails, resized versions)';

-- =====================================================
-- 3. BADGES (managed by subsidiary roles)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_badges (
  badge_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Badge identity
  badge_key          VARCHAR(50) NOT NULL UNIQUE,  -- e.g., 'verified', 'agent', 'merchant_star'
  badge_name         VARCHAR(100) NOT NULL,         -- Display name
  description        TEXT,

  -- Visual
  icon_url           TEXT,
  color              VARCHAR(7),  -- Hex color, e.g., '#10B981'

  -- Ownership & RBAC
  subsidiary_id      UUID REFERENCES molam_subsidiaries(subsidiary_id),  -- NULL = global badge
  required_role      VARCHAR(50),  -- Role required to assign this badge (e.g., 'admin', 'moderator')

  -- Behavior
  is_revokable       BOOLEAN DEFAULT true,
  max_count          INTEGER,  -- Max users who can have this badge (NULL = unlimited)

  -- Metadata
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  created_by         UUID REFERENCES molam_users(user_id),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  is_active          BOOLEAN DEFAULT true
);

CREATE INDEX idx_badges_subsidiary ON molam_badges(subsidiary_id);
CREATE INDEX idx_badges_key ON molam_badges(badge_key);
CREATE INDEX idx_badges_active ON molam_badges(is_active);

COMMENT ON TABLE molam_badges IS 'Badge definitions managed by subsidiary roles';
COMMENT ON COLUMN molam_badges.subsidiary_id IS 'NULL for global badges, or specific subsidiary for subsidiary-owned badges';
COMMENT ON COLUMN molam_badges.required_role IS 'Role required to assign/revoke this badge';

-- Preload common badges
INSERT INTO molam_badges (badge_key, badge_name, description, icon_url, color, subsidiary_id, required_role, is_revokable) VALUES
  ('verified', 'Verified', 'Identity verified by Molam', NULL, '#10B981', NULL, 'admin', false),
  ('early_adopter', 'Early Adopter', 'Joined during beta period', NULL, '#3B82F6', NULL, 'admin', false),
  ('agent_pay', 'MolamPay Agent', 'Official MolamPay agent', NULL, '#10B981', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'pay' LIMIT 1), 'pay_admin', true),
  ('merchant_eats', 'MolamEats Merchant', 'Verified restaurant partner', NULL, '#F97316', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'eats' LIMIT 1), 'eats_admin', true),
  ('merchant_star_eats', 'MolamEats Star', 'Top-rated restaurant', NULL, '#EAB308', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'eats' LIMIT 1), 'eats_admin', true),
  ('driver_eats', 'MolamEats Driver', 'Verified delivery driver', NULL, '#3B82F6', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'eats' LIMIT 1), 'eats_admin', true),
  ('merchant_shop', 'MolamShop Seller', 'Verified e-commerce seller', NULL, '#A855F7', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'shop' LIMIT 1), 'shop_admin', true),
  ('merchant_star_shop', 'MolamShop Star', 'Top-rated seller', NULL, '#EAB308', (SELECT subsidiary_id FROM molam_subsidiaries WHERE subsidiary_key = 'shop' LIMIT 1), 'shop_admin', true);

-- =====================================================
-- 4. USER BADGES (assignment)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_user_badges (
  user_badge_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,
  badge_id           UUID NOT NULL REFERENCES molam_badges(badge_id) ON DELETE CASCADE,

  -- Assignment info
  assigned_by        UUID NOT NULL REFERENCES molam_users(user_id),
  assigned_at        TIMESTAMPTZ DEFAULT NOW(),
  assigned_reason    TEXT,

  -- Revocation
  revoked_at         TIMESTAMPTZ,
  revoked_by         UUID REFERENCES molam_users(user_id),
  revoked_reason     TEXT,

  -- Visibility
  is_visible         BOOLEAN DEFAULT true,  -- User can choose to hide badges

  -- Metadata
  metadata           JSONB DEFAULT '{}',  -- Extra data (e.g., score for star badge)

  -- Constraints
  CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id, revoked_at)  -- Allow re-assignment after revocation
);

CREATE INDEX idx_user_badges_user ON molam_user_badges(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_badges_badge ON molam_user_badges(badge_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_badges_assigned ON molam_user_badges(assigned_at);
CREATE INDEX idx_user_badges_visible ON molam_user_badges(is_visible) WHERE revoked_at IS NULL;

COMMENT ON TABLE molam_user_badges IS 'Badge assignments with full audit trail';
COMMENT ON COLUMN molam_user_badges.is_visible IS 'User can choose to hide badges from their profile';

-- =====================================================
-- 5. USER ACTIVITY (cross-module, privacy-aware)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_user_activity (
  activity_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Activity type
  activity_type      VARCHAR(50) NOT NULL,  -- e.g., 'payment_sent', 'order_placed', 'review_posted'
  subsidiary_id      UUID REFERENCES molam_subsidiaries(subsidiary_id),

  -- Activity data
  activity_title     TEXT NOT NULL,  -- Display text, e.g., "Made a payment"
  activity_subtitle  TEXT,           -- Additional context
  activity_data      JSONB DEFAULT '{}',  -- Module-specific data (amounts, references, etc.)

  -- References (optional, for linking)
  reference_type     VARCHAR(50),    -- e.g., 'transaction', 'order', 'review'
  reference_id       UUID,           -- ID of the referenced entity

  -- Privacy
  visibility         VARCHAR(20) DEFAULT 'contacts' CHECK (visibility IN ('public', 'contacts', 'private')),

  -- Metadata
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  ip_address         INET,
  user_agent         TEXT
);

CREATE INDEX idx_activity_user_id ON molam_user_activity(user_id, created_at DESC);
CREATE INDEX idx_activity_type ON molam_user_activity(activity_type);
CREATE INDEX idx_activity_subsidiary ON molam_user_activity(subsidiary_id);
CREATE INDEX idx_activity_reference ON molam_user_activity(reference_type, reference_id);
CREATE INDEX idx_activity_visibility ON molam_user_activity(visibility);
CREATE INDEX idx_activity_created ON molam_user_activity(created_at DESC);

COMMENT ON TABLE molam_user_activity IS 'Cross-module activity feed (privacy-aware, read-only)';
COMMENT ON COLUMN molam_user_activity.visibility IS 'Who can see this activity: public, contacts, private';

-- =====================================================
-- 6. USER PRIVACY SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_user_privacy (
  privacy_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Field-level visibility
  visibility_display_name    VARCHAR(20) DEFAULT 'public' CHECK (visibility_display_name IN ('public', 'contacts', 'private')),
  visibility_bio             VARCHAR(20) DEFAULT 'public' CHECK (visibility_bio IN ('public', 'contacts', 'private')),
  visibility_location        VARCHAR(20) DEFAULT 'public' CHECK (visibility_location IN ('public', 'contacts', 'private')),
  visibility_avatar          VARCHAR(20) DEFAULT 'public' CHECK (visibility_avatar IN ('public', 'contacts', 'private')),
  visibility_banner          VARCHAR(20) DEFAULT 'public' CHECK (visibility_banner IN ('public', 'contacts', 'private')),
  visibility_badges          VARCHAR(20) DEFAULT 'public' CHECK (visibility_badges IN ('public', 'contacts', 'private')),
  visibility_activity        VARCHAR(20) DEFAULT 'contacts' CHECK (visibility_activity IN ('public', 'contacts', 'private')),

  -- Feature toggles
  allow_activity_tracking    BOOLEAN DEFAULT true,
  allow_profile_indexing     BOOLEAN DEFAULT true,  -- Search engines

  -- Metadata
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_privacy_user_id ON molam_user_privacy(user_id);

COMMENT ON TABLE molam_user_privacy IS 'Granular privacy settings per user';
COMMENT ON COLUMN molam_user_privacy.allow_activity_tracking IS 'Whether to track user activity for feed';

-- =====================================================
-- 7. AUDIT TRAIL (GDPR-ready)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_profile_audit (
  audit_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Change tracking
  table_name         VARCHAR(50) NOT NULL,
  record_id          UUID NOT NULL,
  action             VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Old/new values
  old_values         JSONB,
  new_values         JSONB,

  -- Actor
  changed_by         UUID REFERENCES molam_users(user_id),
  changed_at         TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  ip_address         INET,
  user_agent         TEXT,
  reason             TEXT
);

CREATE INDEX idx_profile_audit_user ON molam_profile_audit(user_id, changed_at DESC);
CREATE INDEX idx_profile_audit_table ON molam_profile_audit(table_name, record_id);
CREATE INDEX idx_profile_audit_action ON molam_profile_audit(action);
CREATE INDEX idx_profile_audit_changed ON molam_profile_audit(changed_at DESC);

COMMENT ON TABLE molam_profile_audit IS 'Complete audit trail for all profile changes (GDPR compliance)';

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON molam_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trg_media_assets_updated
  BEFORE UPDATE ON molam_media_assets
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trg_badges_updated
  BEFORE UPDATE ON molam_badges
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

CREATE TRIGGER trg_privacy_updated
  BEFORE UPDATE ON molam_user_privacy
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

-- Audit trail trigger
CREATE OR REPLACE FUNCTION log_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO molam_profile_audit (user_id, table_name, record_id, action, old_values, changed_by)
    VALUES (OLD.user_id, TG_TABLE_NAME, OLD.profile_id, 'DELETE', row_to_json(OLD), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO molam_profile_audit (user_id, table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (NEW.user_id, TG_TABLE_NAME, NEW.profile_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO molam_profile_audit (user_id, table_name, record_id, action, new_values, changed_by)
    VALUES (NEW.user_id, TG_TABLE_NAME, NEW.profile_id, 'INSERT', row_to_json(NEW), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profile_audit
  AFTER INSERT OR UPDATE OR DELETE ON molam_user_profiles
  FOR EACH ROW EXECUTE FUNCTION log_profile_change();

-- Update badge count cache
CREATE OR REPLACE FUNCTION update_badge_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE molam_user_profiles
    SET badge_count = (
      SELECT COUNT(*) FROM molam_user_badges
      WHERE user_id = NEW.user_id AND revoked_at IS NULL AND is_visible = true
    )
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE molam_user_profiles
    SET badge_count = (
      SELECT COUNT(*) FROM molam_user_badges
      WHERE user_id = OLD.user_id AND revoked_at IS NULL AND is_visible = true
    )
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_badge_count
  AFTER INSERT OR UPDATE OR DELETE ON molam_user_badges
  FOR EACH ROW EXECUTE FUNCTION update_badge_count();

-- Update activity count cache
CREATE OR REPLACE FUNCTION update_activity_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE molam_user_profiles
    SET activity_count = (
      SELECT COUNT(*) FROM molam_user_activity
      WHERE user_id = NEW.user_id AND visibility != 'private'
    )
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE molam_user_profiles
    SET activity_count = (
      SELECT COUNT(*) FROM molam_user_activity
      WHERE user_id = OLD.user_id AND visibility != 'private'
    )
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_count
  AFTER INSERT OR DELETE ON molam_user_activity
  FOR EACH ROW EXECUTE FUNCTION update_activity_count();

-- Auto-create profile and privacy settings for new users
CREATE OR REPLACE FUNCTION create_default_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO molam_user_profiles (user_id, display_name)
  VALUES (NEW.user_id, COALESCE(NEW.first_name || ' ' || NEW.last_name, NEW.email));

  -- Create privacy settings
  INSERT INTO molam_user_privacy (user_id)
  VALUES (NEW.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_default_profile
  AFTER INSERT ON molam_users
  FOR EACH ROW EXECUTE FUNCTION create_default_profile();

-- =====================================================
-- 9. FUNCTIONS
-- =====================================================

-- Get user profile with privacy filtering
CREATE OR REPLACE FUNCTION get_user_profile(
  p_user_id UUID,
  p_viewer_id UUID DEFAULT NULL
) RETURNS TABLE(
  profile_id UUID,
  user_id UUID,
  display_name VARCHAR,
  bio TEXT,
  country_code CHAR,
  city VARCHAR,
  avatar_url TEXT,
  banner_url TEXT,
  preferred_language VARCHAR,
  preferred_currency CHAR,
  badge_count INTEGER,
  activity_count INTEGER,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_visibility_level VARCHAR(20);
  v_is_contact BOOLEAN := false;
BEGIN
  -- Get profile visibility level
  SELECT up.visibility_level INTO v_visibility_level
  FROM molam_user_profiles up
  WHERE up.user_id = p_user_id;

  -- Check if viewer is a contact (simplified - would check contacts table in real implementation)
  IF p_viewer_id IS NOT NULL AND p_viewer_id != p_user_id THEN
    -- TODO: Check if p_viewer_id is in p_user_id's contacts
    v_is_contact := false;
  END IF;

  -- Return filtered profile based on visibility
  RETURN QUERY
  SELECT
    up.profile_id,
    up.user_id,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.display_name
      ELSE NULL
    END AS display_name,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.bio
      ELSE NULL
    END AS bio,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.country_code
      ELSE NULL
    END AS country_code,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.city
      ELSE NULL
    END AS city,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.avatar_url
      ELSE NULL
    END AS avatar_url,
    CASE
      WHEN v_visibility_level = 'public' OR p_viewer_id = p_user_id OR (v_visibility_level = 'contacts' AND v_is_contact) THEN up.banner_url
      ELSE NULL
    END AS banner_url,
    up.preferred_language,
    up.preferred_currency,
    up.badge_count,
    up.activity_count,
    up.created_at
  FROM molam_user_profiles up
  WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Get user badges (visible only)
CREATE OR REPLACE FUNCTION get_user_badges(p_user_id UUID)
RETURNS TABLE(
  badge_id UUID,
  badge_key VARCHAR,
  badge_name VARCHAR,
  description TEXT,
  icon_url TEXT,
  color VARCHAR,
  assigned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.badge_id,
    b.badge_key,
    b.badge_name,
    b.description,
    b.icon_url,
    b.color,
    ub.assigned_at
  FROM molam_user_badges ub
  JOIN molam_badges b ON ub.badge_id = b.badge_id
  WHERE ub.user_id = p_user_id
    AND ub.revoked_at IS NULL
    AND ub.is_visible = true
    AND b.is_active = true
  ORDER BY ub.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get user activity feed (privacy-aware)
CREATE OR REPLACE FUNCTION get_user_activity_feed(
  p_user_id UUID,
  p_viewer_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
  activity_id UUID,
  activity_type VARCHAR,
  activity_title TEXT,
  activity_subtitle TEXT,
  subsidiary_id UUID,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_is_contact BOOLEAN := false;
BEGIN
  -- Check if viewer is a contact
  IF p_viewer_id IS NOT NULL AND p_viewer_id != p_user_id THEN
    v_is_contact := false;  -- TODO: Check contacts table
  END IF;

  RETURN QUERY
  SELECT
    ua.activity_id,
    ua.activity_type,
    ua.activity_title,
    ua.activity_subtitle,
    ua.subsidiary_id,
    ua.created_at
  FROM molam_user_activity ua
  WHERE ua.user_id = p_user_id
    AND (
      ua.visibility = 'public'
      OR (ua.visibility = 'contacts' AND (p_viewer_id = p_user_id OR v_is_contact))
      OR (ua.visibility = 'private' AND p_viewer_id = p_user_id)
    )
  ORDER BY ua.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Assign badge (with RBAC check)
CREATE OR REPLACE FUNCTION assign_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_assigned_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_badge_key VARCHAR(50);
  v_required_role VARCHAR(50);
  v_user_badge_id UUID;
BEGIN
  -- Get badge info
  SELECT badge_key, required_role INTO v_badge_key, v_required_role
  FROM molam_badges
  WHERE badge_id = p_badge_id AND is_active = true;

  IF v_badge_key IS NULL THEN
    RAISE EXCEPTION 'Badge not found or inactive';
  END IF;

  -- TODO: Check if p_assigned_by has v_required_role
  -- For now, we trust the caller to have done RBAC check

  -- Check if badge already assigned
  IF EXISTS (
    SELECT 1 FROM molam_user_badges
    WHERE user_id = p_user_id AND badge_id = p_badge_id AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Badge already assigned to user';
  END IF;

  -- Assign badge
  INSERT INTO molam_user_badges (user_id, badge_id, assigned_by, assigned_reason)
  VALUES (p_user_id, p_badge_id, p_assigned_by, p_reason)
  RETURNING user_badge_id INTO v_user_badge_id;

  RETURN v_user_badge_id;
END;
$$ LANGUAGE plpgsql;

-- Revoke badge
CREATE OR REPLACE FUNCTION revoke_badge(
  p_user_badge_id UUID,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_badge_id UUID;
  v_is_revokable BOOLEAN;
BEGIN
  -- Get badge info
  SELECT ub.badge_id, b.is_revokable INTO v_badge_id, v_is_revokable
  FROM molam_user_badges ub
  JOIN molam_badges b ON ub.badge_id = b.badge_id
  WHERE ub.user_badge_id = p_user_badge_id AND ub.revoked_at IS NULL;

  IF v_badge_id IS NULL THEN
    RAISE EXCEPTION 'User badge not found or already revoked';
  END IF;

  IF NOT v_is_revokable THEN
    RAISE EXCEPTION 'Badge is not revokable';
  END IF;

  -- Revoke badge
  UPDATE molam_user_badges
  SET revoked_at = NOW(), revoked_by = p_revoked_by, revoked_reason = p_reason
  WHERE user_badge_id = p_user_badge_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Log activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_activity_title TEXT,
  p_activity_subtitle TEXT DEFAULT NULL,
  p_subsidiary_id UUID DEFAULT NULL,
  p_activity_data JSONB DEFAULT '{}',
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_visibility VARCHAR DEFAULT 'contacts'
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
  v_tracking_enabled BOOLEAN;
BEGIN
  -- Check if activity tracking is enabled for user
  SELECT allow_activity_tracking INTO v_tracking_enabled
  FROM molam_user_privacy
  WHERE user_id = p_user_id;

  IF NOT COALESCE(v_tracking_enabled, true) THEN
    RETURN NULL;  -- Activity tracking disabled
  END IF;

  INSERT INTO molam_user_activity (
    user_id, activity_type, activity_title, activity_subtitle,
    subsidiary_id, activity_data, reference_type, reference_id, visibility
  ) VALUES (
    p_user_id, p_activity_type, p_activity_title, p_activity_subtitle,
    p_subsidiary_id, p_activity_data, p_reference_type, p_reference_id, p_visibility
  ) RETURNING activity_id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;

-- GDPR: Get all user data
CREATE OR REPLACE FUNCTION get_all_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(up) FROM molam_user_profiles up WHERE up.user_id = p_user_id),
    'privacy', (SELECT row_to_json(priv) FROM molam_user_privacy priv WHERE priv.user_id = p_user_id),
    'badges', (SELECT jsonb_agg(row_to_json(ub)) FROM molam_user_badges ub WHERE ub.user_id = p_user_id),
    'activity', (SELECT jsonb_agg(row_to_json(ua)) FROM molam_user_activity ua WHERE ua.user_id = p_user_id),
    'media', (SELECT jsonb_agg(row_to_json(ma)) FROM molam_media_assets ma WHERE ma.user_id = p_user_id),
    'audit', (SELECT jsonb_agg(row_to_json(pa)) FROM molam_profile_audit pa WHERE pa.user_id = p_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- GDPR: Delete all user data
CREATE OR REPLACE FUNCTION delete_all_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Soft delete media assets
  UPDATE molam_media_assets SET deleted_at = NOW() WHERE user_id = p_user_id;

  -- Delete activity
  DELETE FROM molam_user_activity WHERE user_id = p_user_id;

  -- Revoke badges
  UPDATE molam_user_badges SET revoked_at = NOW(), revoked_reason = 'GDPR deletion' WHERE user_id = p_user_id AND revoked_at IS NULL;

  -- Delete privacy settings
  DELETE FROM molam_user_privacy WHERE user_id = p_user_id;

  -- Anonymize profile
  UPDATE molam_user_profiles
  SET display_name = 'Deleted User',
      bio = NULL,
      country_code = NULL,
      city = NULL,
      avatar_url = NULL,
      banner_url = NULL,
      avatar_asset_id = NULL,
      banner_asset_id = NULL
  WHERE user_id = p_user_id;

  -- Keep audit trail for compliance (do NOT delete molam_profile_audit)

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. VIEWS
-- =====================================================

-- Active badges view
CREATE OR REPLACE VIEW v_active_badges AS
SELECT
  ub.user_badge_id,
  ub.user_id,
  u.email,
  b.badge_key,
  b.badge_name,
  b.color,
  ub.assigned_at,
  ub.assigned_by,
  s.subsidiary_name
FROM molam_user_badges ub
JOIN molam_users u ON ub.user_id = u.user_id
JOIN molam_badges b ON ub.badge_id = b.badge_id
LEFT JOIN molam_subsidiaries s ON b.subsidiary_id = s.subsidiary_id
WHERE ub.revoked_at IS NULL
  AND ub.is_visible = true
  AND b.is_active = true;

-- Badge statistics view
CREATE OR REPLACE VIEW v_badge_statistics AS
SELECT
  b.badge_id,
  b.badge_key,
  b.badge_name,
  b.subsidiary_id,
  s.subsidiary_name,
  COUNT(ub.user_badge_id) AS total_assignments,
  COUNT(CASE WHEN ub.revoked_at IS NULL THEN 1 END) AS active_assignments,
  b.max_count,
  CASE
    WHEN b.max_count IS NOT NULL
    THEN ROUND((COUNT(CASE WHEN ub.revoked_at IS NULL THEN 1 END)::NUMERIC / b.max_count) * 100, 2)
    ELSE NULL
  END AS utilization_pct
FROM molam_badges b
LEFT JOIN molam_subsidiaries s ON b.subsidiary_id = s.subsidiary_id
LEFT JOIN molam_user_badges ub ON b.badge_id = ub.badge_id
WHERE b.is_active = true
GROUP BY b.badge_id, b.badge_key, b.badge_name, b.subsidiary_id, s.subsidiary_name, b.max_count;

-- User profile summary view
CREATE OR REPLACE VIEW v_user_profile_summary AS
SELECT
  up.user_id,
  u.email,
  up.display_name,
  up.country_code,
  up.city,
  up.preferred_language,
  up.preferred_currency,
  up.badge_count,
  up.activity_count,
  up.visibility_level,
  up.created_at,
  up.updated_at
FROM molam_user_profiles up
JOIN molam_users u ON up.user_id = u.user_id;

-- =====================================================
-- 11. ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE molam_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_user_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_profile_audit ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY user_profiles_select_own ON molam_user_profiles
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY user_profiles_update_own ON molam_user_profiles
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Policies for media_assets
CREATE POLICY media_assets_select_own ON molam_media_assets
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY media_assets_insert_own ON molam_media_assets
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY media_assets_update_own ON molam_media_assets
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Policies for user_activity
CREATE POLICY user_activity_select_own ON molam_user_activity
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Policies for user_privacy
CREATE POLICY user_privacy_select_own ON molam_user_privacy
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY user_privacy_update_own ON molam_user_privacy
  FOR UPDATE USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Policies for profile_audit (read-only for users, admins can see all)
CREATE POLICY profile_audit_select_own ON molam_profile_audit
  FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- =====================================================
-- END OF MIGRATION
-- =====================================================
