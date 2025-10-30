-- ============================================================================
-- Brique 19: Export Profile (GDPR, JSON/PDF)
-- ============================================================================
-- Description: User data export for GDPR compliance (data portability)
-- Dependencies: Brique 14 (audit), Brique 15 (i18n), Brique 18 (profile)
-- ============================================================================

-- Export jobs table
CREATE TABLE IF NOT EXISTS molam_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  locale TEXT DEFAULT 'fr',
  json_object_key TEXT,
  pdf_object_key TEXT,
  signed_json_url TEXT,
  signed_pdf_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Comments
COMMENT ON TABLE molam_exports IS 'User data export jobs (GDPR compliance)';
COMMENT ON COLUMN molam_exports.user_id IS 'User whose data is being exported';
COMMENT ON COLUMN molam_exports.requested_by IS 'User who requested the export (admin or self)';
COMMENT ON COLUMN molam_exports.status IS 'Job status: queued, processing, ready, failed';
COMMENT ON COLUMN molam_exports.locale IS 'Language for PDF labels (ISO 639-1)';
COMMENT ON COLUMN molam_exports.json_object_key IS 'S3/MinIO key for JSON file';
COMMENT ON COLUMN molam_exports.pdf_object_key IS 'S3/MinIO key for PDF file';
COMMENT ON COLUMN molam_exports.signed_json_url IS 'Ephemeral signed URL for JSON download';
COMMENT ON COLUMN molam_exports.signed_pdf_url IS 'Ephemeral signed URL for PDF download';
COMMENT ON COLUMN molam_exports.expires_at IS 'When signed URLs expire (typically 15 minutes)';
COMMENT ON COLUMN molam_exports.error IS 'Error message if status=failed';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exports_user ON molam_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_status ON molam_exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_created ON molam_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_requested_by ON molam_exports(requested_by);

-- ============================================================================
-- Exportable Data Views (GDPR scope: Molam ID only)
-- ============================================================================

-- View: User Profile (basic info + preferences)
CREATE OR REPLACE VIEW v_export_user_profile AS
SELECT
  u.id as user_id,
  u.molam_id,
  u.email,
  u.phone_e164,
  u.first_name,
  u.last_name,
  u.preferred_language,
  u.preferred_currency,
  u.timezone,
  u.date_format,
  u.number_format,
  u.created_at as user_created_at,
  u.updated_at as user_updated_at,
  p.theme,
  p.notify_email,
  p.notify_sms,
  p.notify_push,
  p.updated_at as preferences_updated_at
FROM molam_users u
LEFT JOIN molam_profiles p ON p.user_id = u.id;

COMMENT ON VIEW v_export_user_profile IS 'Exportable user profile data (GDPR)';

-- View: User Contacts
CREATE OR REPLACE VIEW v_export_user_contacts AS
SELECT
  c.owner_user_id as user_id,
  c.id as contact_id,
  c.display_name,
  c.channel_type,
  c.channel_value,
  c.country_code,
  c.metadata,
  c.created_at,
  c.updated_at
FROM molam_user_contacts c
ORDER BY c.owner_user_id, c.display_name ASC;

COMMENT ON VIEW v_export_user_contacts IS 'Exportable user contacts (GDPR)';

-- View: ID Events (non-sensitive audit logs)
CREATE OR REPLACE VIEW v_export_id_events AS
SELECT
  a.user_id,
  a.id as event_id,
  a.action,
  a.resource_type,
  a.metadata,
  a.ip_address,
  a.created_at
FROM molam_audit_logs a
WHERE
  a.action LIKE 'id.%'
  OR a.action LIKE 'profile.%'
  OR a.action LIKE 'contacts.%'
ORDER BY a.user_id, a.created_at DESC;

COMMENT ON VIEW v_export_id_events IS 'Exportable ID events (non-sensitive audit logs)';

-- View: Active Sessions (optional)
CREATE OR REPLACE VIEW v_export_user_sessions AS
SELECT
  s.user_id,
  s.id as session_id,
  s.device_name,
  s.ip_address,
  s.user_agent,
  s.created_at as session_started_at,
  s.last_activity_at,
  s.expires_at as session_expires_at
FROM molam_sessions s
WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
ORDER BY s.user_id, s.created_at DESC;

COMMENT ON VIEW v_export_user_sessions IS 'Active user sessions (GDPR)';

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get consolidated export data as JSONB
CREATE OR REPLACE FUNCTION get_export_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
  v_contacts JSONB;
  v_events JSONB;
  v_sessions JSONB;
BEGIN
  -- Profile
  SELECT to_jsonb(v.*) INTO v_profile
  FROM v_export_user_profile v
  WHERE v.user_id = p_user_id;

  -- Contacts
  SELECT jsonb_agg(to_jsonb(c.*)) INTO v_contacts
  FROM v_export_user_contacts c
  WHERE c.user_id = p_user_id;

  -- Events (last 1000)
  SELECT jsonb_agg(to_jsonb(e.*)) INTO v_events
  FROM (
    SELECT * FROM v_export_id_events
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1000
  ) e;

  -- Sessions
  SELECT jsonb_agg(to_jsonb(s.*)) INTO v_sessions
  FROM v_export_user_sessions s
  WHERE s.user_id = p_user_id;

  RETURN jsonb_build_object(
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'contacts', COALESCE(v_contacts, '[]'::jsonb),
    'events', COALESCE(v_events, '[]'::jsonb),
    'sessions', COALESCE(v_sessions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_export_data(UUID) IS 'Get all exportable data for a user as JSONB';

-- Function: Check if user can request export (rate limit)
CREATE OR REPLACE FUNCTION can_request_export(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_export TIMESTAMPTZ;
  v_cooldown_hours INTEGER := 24;
BEGIN
  -- Get last export time
  SELECT MAX(created_at) INTO v_last_export
  FROM molam_exports
  WHERE user_id = p_user_id;

  -- If no export or older than cooldown, allow
  IF v_last_export IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN (NOW() - v_last_export) > (v_cooldown_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION can_request_export(UUID) IS 'Check if user can request export (24h cooldown)';

-- Function: Get export statistics
CREATE OR REPLACE FUNCTION get_export_stats()
RETURNS TABLE (
  total_exports BIGINT,
  queued BIGINT,
  processing BIGINT,
  ready BIGINT,
  failed BIGINT,
  avg_processing_seconds NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_exports,
    COUNT(*) FILTER (WHERE status = 'queued')::BIGINT as queued,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT as processing,
    COUNT(*) FILTER (WHERE status = 'ready')::BIGINT as ready,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))::NUMERIC as avg_processing_seconds
  FROM molam_exports;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_export_stats() IS 'Get export statistics';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_export_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_exports_updated
  BEFORE UPDATE ON molam_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_export_timestamp();

-- ============================================================================
-- Cleanup Old Exports (retention policy)
-- ============================================================================

-- Function: Clean up old exports (30 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM molam_exports
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_exports() IS 'Delete exports older than 30 days';

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON molam_exports TO molam_app;
GRANT SELECT ON v_export_user_profile TO molam_app;
GRANT SELECT ON v_export_user_contacts TO molam_app;
GRANT SELECT ON v_export_id_events TO molam_app;
GRANT SELECT ON v_export_user_sessions TO molam_app;
GRANT EXECUTE ON FUNCTION get_export_data(UUID) TO molam_app;
GRANT EXECUTE ON FUNCTION can_request_export(UUID) TO molam_app;
GRANT EXECUTE ON FUNCTION get_export_stats() TO molam_app;
GRANT EXECUTE ON FUNCTION cleanup_old_exports() TO molam_app;
