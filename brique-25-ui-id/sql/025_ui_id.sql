-- 025_ui_id.sql
-- Molam ID UI Management - User settings, devices, notifications, and audit views
-- Author: Molam Corp
-- Date: 2025-10-28

-- ============================================================================
-- USER SETTINGS
-- ============================================================================

-- User settings (language, currency, country, time zone, accessibility, theme)
CREATE TABLE IF NOT EXISTS molam_user_settings (
  user_id UUID PRIMARY KEY REFERENCES molam_users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'fr',
  currency_code TEXT NOT NULL DEFAULT 'XOF',
  country_code TEXT NOT NULL DEFAULT 'SN',
  time_zone TEXT NOT NULL DEFAULT 'Africa/Dakar',
  theme TEXT NOT NULL DEFAULT 'system', -- system|light|dark
  accessibility JSONB NOT NULL DEFAULT '{"voice_mode":false,"large_text":false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON molam_user_settings(user_id);

COMMENT ON TABLE molam_user_settings IS 'User preferences for language, currency, timezone, theme, and accessibility';
COMMENT ON COLUMN molam_user_settings.theme IS 'UI theme preference: system (auto), light, or dark';
COMMENT ON COLUMN molam_user_settings.accessibility IS 'Accessibility settings: voice_mode, large_text, high_contrast, etc.';

-- ============================================================================
-- USER DEVICES
-- ============================================================================

-- User devices (device fingerprinting, last seen, trust level)
CREATE TABLE IF NOT EXISTS molam_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios','android','web','desktop','harmony','ussd','api')),
  device_name TEXT, -- User-friendly name (e.g., "iPhone 15 Pro")
  os_version TEXT,
  app_version TEXT,
  ip INET,
  user_agent TEXT,
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON molam_user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_revoked ON molam_user_devices(user_id, revoked_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE molam_user_devices IS 'Registered user devices with trust levels and activity tracking';
COMMENT ON COLUMN molam_user_devices.is_trusted IS 'Whether the user has explicitly trusted this device';
COMMENT ON COLUMN molam_user_devices.device_name IS 'User-friendly device name for UI display';

-- ============================================================================
-- USER NOTIFICATIONS
-- ============================================================================

-- Notifications (security & product)
CREATE TABLE IF NOT EXISTS molam_user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('security','product','legal','system')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT, -- Optional action link (e.g., /security/sessions)
  action_label TEXT, -- Action button text (e.g., "Review Sessions")
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_user ON molam_user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_notif_created ON molam_user_notifications(user_id, created_at DESC);

COMMENT ON TABLE molam_user_notifications IS 'User notifications for security alerts, product updates, and legal notices';
COMMENT ON COLUMN molam_user_notifications.category IS 'Notification category: security, product, legal, system';
COMMENT ON COLUMN molam_user_notifications.severity IS 'Notification severity: info, warning, critical';

-- ============================================================================
-- AUDIT VIEWS
-- ============================================================================

-- Personal audit view (read-only aggregation)
CREATE OR REPLACE VIEW molam_user_audit_view AS
  SELECT
    a.id,
    a.user_id,
    a.action,
    a.context,
    a.ip_address,
    a.user_agent,
    a.created_at
  FROM molam_audit_logs a
  WHERE a.user_id IS NOT NULL
  ORDER BY a.created_at DESC;

COMMENT ON VIEW molam_user_audit_view IS 'Personal audit trail visible to users (read-only)';

-- ============================================================================
-- ENHANCE EXISTING TABLES
-- ============================================================================

-- Harden previous tables (if not already present)
ALTER TABLE molam_sessions_active
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_user ON molam_sessions_active(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON molam_sessions_active(device_id) WHERE revoked_at IS NULL;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get user settings with defaults
CREATE OR REPLACE FUNCTION get_user_settings(p_user_id UUID)
RETURNS TABLE(
  language_code TEXT,
  currency_code TEXT,
  country_code TEXT,
  time_zone TEXT,
  theme TEXT,
  accessibility JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(s.language_code, 'fr') AS language_code,
    COALESCE(s.currency_code, 'XOF') AS currency_code,
    COALESCE(s.country_code, 'SN') AS country_code,
    COALESCE(s.time_zone, 'Africa/Dakar') AS time_zone,
    COALESCE(s.theme, 'system') AS theme,
    COALESCE(s.accessibility, '{}'::JSONB) AS accessibility
  FROM molam_users u
  LEFT JOIN molam_user_settings s ON s.user_id = u.id
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_settings IS 'Get user settings with fallback to defaults';

-- Function: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE molam_user_notifications
  SET is_read = true, read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = p_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated = (ROW_COUNT > 0);
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_notification_read IS 'Mark a notification as read (with user ownership check)';

-- Function: Create security notification
CREATE OR REPLACE FUNCTION create_security_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_severity TEXT DEFAULT 'warning',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO molam_user_notifications(
    user_id, category, severity, title, body, action_url, action_label
  )
  VALUES(
    p_user_id, 'security', p_severity, p_title, p_body, p_action_url, p_action_label
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_security_notification IS 'Create a security notification for a user';

-- Function: Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM molam_user_notifications
  WHERE user_id = p_user_id AND is_read = false;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_unread_notification_count IS 'Get count of unread notifications for a user';

-- Function: Revoke all user devices
CREATE OR REPLACE FUNCTION revoke_all_user_devices(p_user_id UUID, p_except_device_id TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE molam_user_devices
  SET revoked_at = NOW()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (p_except_device_id IS NULL OR device_id != p_except_device_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revoke_all_user_devices IS 'Revoke all devices for a user (optionally excluding current device)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at on settings change
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_settings_update
  BEFORE UPDATE ON molam_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_timestamp();

-- Trigger: Update device last_seen on activity
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE molam_user_devices
  SET last_seen_at = NOW()
  WHERE device_id = NEW.device_id AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would be attached to session activity or login events
-- For now, we'll update last_seen manually via API calls

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create default settings for existing users (if any)
INSERT INTO molam_user_settings (user_id)
SELECT id FROM molam_users
WHERE id NOT IN (SELECT user_id FROM molam_user_settings)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- PERMISSIONS & SECURITY
-- ============================================================================

-- Row-level security (RLS) policies
ALTER TABLE molam_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_user_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own settings
CREATE POLICY user_settings_select_own ON molam_user_settings
  FOR SELECT USING (user_id = current_setting('app.user_id', true)::UUID);

CREATE POLICY user_settings_update_own ON molam_user_settings
  FOR UPDATE USING (user_id = current_setting('app.user_id', true)::UUID);

-- Policy: Users can only see their own devices
CREATE POLICY user_devices_select_own ON molam_user_devices
  FOR SELECT USING (user_id = current_setting('app.user_id', true)::UUID);

CREATE POLICY user_devices_update_own ON molam_user_devices
  FOR UPDATE USING (user_id = current_setting('app.user_id', true)::UUID);

-- Policy: Users can only see their own notifications
CREATE POLICY user_notifications_select_own ON molam_user_notifications
  FOR SELECT USING (user_id = current_setting('app.user_id', true)::UUID);

CREATE POLICY user_notifications_update_own ON molam_user_notifications
  FOR UPDATE USING (user_id = current_setting('app.user_id', true)::UUID);

-- ============================================================================
-- ANALYTICS & MONITORING
-- ============================================================================

-- View: Device type distribution
CREATE OR REPLACE VIEW molam_device_type_stats AS
SELECT
  device_type,
  COUNT(*) AS total_devices,
  COUNT(*) FILTER (WHERE is_trusted) AS trusted_devices,
  COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active_devices
FROM molam_user_devices
GROUP BY device_type;

COMMENT ON VIEW molam_device_type_stats IS 'Device type distribution statistics';

-- View: Notification stats by category
CREATE OR REPLACE VIEW molam_notification_stats AS
SELECT
  category,
  severity,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_read) AS read_count,
  COUNT(*) FILTER (WHERE NOT is_read) AS unread_count
FROM molam_user_notifications
GROUP BY category, severity;

COMMENT ON VIEW molam_notification_stats IS 'Notification statistics by category and severity';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'Molam ID UI Management - Brique 25 - Migration 025 applied successfully';
