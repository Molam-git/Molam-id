-- ============================================================================
-- Brique 18: API Update Profile (Language, Currency, Contacts)
-- ============================================================================
-- Description: Extend user profile with preferences and favorite contacts
-- Dependencies: Brique 15 (i18n), Brique 16 (fx), Brique 14 (audit)
-- ============================================================================

-- Extend molam_users with core preferences
ALTER TABLE molam_users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_currency CHAR(3) DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Dakar',
  ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'YYYY-MM-DD',
  ADD COLUMN IF NOT EXISTS number_format TEXT DEFAULT 'space';

-- Add comments
COMMENT ON COLUMN molam_users.preferred_language IS 'ISO 639-1 language code (en, fr, ar)';
COMMENT ON COLUMN molam_users.preferred_currency IS 'ISO 4217 currency code (XOF, USD, EUR)';
COMMENT ON COLUMN molam_users.timezone IS 'IANA timezone (Africa/Dakar, Europe/Paris)';
COMMENT ON COLUMN molam_users.date_format IS 'Date format preference (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)';
COMMENT ON COLUMN molam_users.number_format IS 'Number separator (space, comma, dot)';

-- Extend molam_profiles for UX preferences
ALTER TABLE molam_profiles
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_push BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system';

-- Add comments
COMMENT ON COLUMN molam_profiles.notify_email IS 'Email notifications enabled';
COMMENT ON COLUMN molam_profiles.notify_sms IS 'SMS notifications enabled';
COMMENT ON COLUMN molam_profiles.notify_push IS 'Push notifications enabled';
COMMENT ON COLUMN molam_profiles.theme IS 'UI theme (light, dark, system)';

-- ============================================================================
-- Favorite Contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  contact_user_id UUID REFERENCES molam_users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('molam_id', 'phone', 'email', 'merchant', 'agent')),
  channel_value TEXT NOT NULL,
  country_code CHAR(3),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_contact UNIQUE(owner_user_id, channel_type, channel_value)
);

-- Comments
COMMENT ON TABLE molam_user_contacts IS 'User favorite contacts for P2P, merchants, agents';
COMMENT ON COLUMN molam_user_contacts.owner_user_id IS 'User who owns this contact';
COMMENT ON COLUMN molam_user_contacts.contact_user_id IS 'Resolved Molam user ID (if exists)';
COMMENT ON COLUMN molam_user_contacts.display_name IS 'User-defined contact name';
COMMENT ON COLUMN molam_user_contacts.channel_type IS 'Contact type: molam_id, phone, email, merchant, agent';
COMMENT ON COLUMN molam_user_contacts.channel_value IS 'Normalized value (E.164 for phone, lowercase email)';
COMMENT ON COLUMN molam_user_contacts.country_code IS 'ISO 3166-1 alpha-3 country code';
COMMENT ON COLUMN molam_user_contacts.metadata IS 'Additional contact metadata';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON molam_user_contacts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON molam_user_contacts(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_channel ON molam_user_contacts(channel_type, channel_value);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_contact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON molam_user_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_timestamp();

-- Auto-resolve contact_user_id
CREATE OR REPLACE FUNCTION resolve_contact_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.channel_type = 'molam_id' THEN
    -- Resolve by molam_id
    SELECT id INTO NEW.contact_user_id
    FROM molam_users
    WHERE molam_id = NEW.channel_value
    LIMIT 1;
  ELSIF NEW.channel_type = 'phone' THEN
    -- Resolve by phone_e164
    SELECT id INTO NEW.contact_user_id
    FROM molam_users
    WHERE phone_e164 = NEW.channel_value
    LIMIT 1;
  ELSIF NEW.channel_type = 'email' THEN
    -- Resolve by email (case-insensitive)
    SELECT id INTO NEW.contact_user_id
    FROM molam_users
    WHERE LOWER(email) = LOWER(NEW.channel_value)
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_resolve_user
  BEFORE INSERT OR UPDATE ON molam_user_contacts
  FOR EACH ROW
  EXECUTE FUNCTION resolve_contact_user_id();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get user preferences as JSONB
CREATE OR REPLACE FUNCTION get_user_preferences(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_prefs JSONB;
BEGIN
  SELECT jsonb_build_object(
    'language', u.preferred_language,
    'currency', u.preferred_currency,
    'timezone', u.timezone,
    'dateFormat', u.date_format,
    'numberFormat', u.number_format,
    'notifications', jsonb_build_object(
      'email', p.notify_email,
      'sms', p.notify_sms,
      'push', p.notify_push
    ),
    'theme', p.theme
  ) INTO v_prefs
  FROM molam_users u
  LEFT JOIN molam_profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id;

  RETURN COALESCE(v_prefs, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- Search contacts by name or value
CREATE OR REPLACE FUNCTION search_user_contacts(
  p_owner_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  channel_type TEXT,
  channel_value TEXT,
  country_code CHAR(3),
  contact_user_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.display_name,
    c.channel_type,
    c.channel_value,
    c.country_code,
    c.contact_user_id,
    c.created_at
  FROM molam_user_contacts c
  WHERE c.owner_user_id = p_owner_user_id
    AND (
      p_query IS NULL
      OR c.display_name ILIKE '%' || p_query || '%'
      OR c.channel_value ILIKE '%' || p_query || '%'
    )
  ORDER BY c.display_name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON molam_user_contacts TO molam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO molam_app;
