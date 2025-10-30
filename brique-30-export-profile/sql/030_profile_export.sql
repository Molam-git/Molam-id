-- =====================================================
-- Brique 30: Export profil (GDPR, JSON/PDF signé)
-- =====================================================
-- Description:
--   GDPR-compliant data export system for all users
--   - External users (clients, merchants, partner agents)
--   - Internal users (Molam employees)
--   - Two formats: JSON (signed with HMAC) and PDF (branded)
--   - Asynchronous processing with temporary S3 storage
--   - Automatic expiration and cleanup
--   - Complete audit trail
--
-- Dependencies:
--   - brique-21-sira (molam_users)
--   - brique-29-user-profile (molam_user_profiles, molam_badges, molam_user_activity)
-- =====================================================

-- =====================================================
-- 1. PROFILE EXPORTS TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_profile_exports (
  export_id         BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Export configuration
  format            VARCHAR(10) NOT NULL CHECK (format IN ('json', 'pdf')),
  include_sections  JSONB DEFAULT '["profile", "badges", "activity"]',  -- What to include

  -- Processing status
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'expired')),

  -- Storage
  storage_key       TEXT,  -- S3 key
  storage_url       TEXT,  -- Presigned URL (cached)
  storage_size      BIGINT,  -- File size in bytes

  -- Integrity
  checksum_sha256   TEXT,  -- SHA256 hash for integrity verification
  signature_hmac    TEXT,  -- HMAC signature (for JSON exports)

  -- Lifecycle
  requested_at      TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,  -- Auto-delete after this date

  -- Error handling
  error_message     TEXT,
  retry_count       INTEGER DEFAULT 0,

  -- Metadata
  requested_by      UUID REFERENCES molam_users(user_id),  -- For admin/HR requests
  ip_address        INET,
  user_agent        TEXT,

  -- Audit
  downloaded_count  INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT chk_export_completed CHECK (
    (status = 'ready' AND completed_at IS NOT NULL AND storage_key IS NOT NULL AND checksum_sha256 IS NOT NULL)
    OR status != 'ready'
  )
);

CREATE INDEX idx_exports_user ON molam_profile_exports(user_id, requested_at DESC);
CREATE INDEX idx_exports_status ON molam_profile_exports(status, requested_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_exports_expires ON molam_profile_exports(expires_at) WHERE status = 'ready';

COMMENT ON TABLE molam_profile_exports IS 'GDPR-compliant profile export requests and tracking';
COMMENT ON COLUMN molam_profile_exports.include_sections IS 'Array of sections to include: profile, badges, activity, transactions, media';
COMMENT ON COLUMN molam_profile_exports.requested_by IS 'User who requested export (different from user_id for admin exports)';

-- =====================================================
-- 2. EXPORT SECTIONS METADATA
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_export_sections (
  section_id        SERIAL PRIMARY KEY,
  section_key       VARCHAR(50) NOT NULL UNIQUE,
  section_name      VARCHAR(100) NOT NULL,
  description       TEXT,
  requires_module   VARCHAR(20),  -- pay, eats, shop, etc.
  data_sensitivity  VARCHAR(20) DEFAULT 'medium' CHECK (data_sensitivity IN ('low', 'medium', 'high', 'critical')),
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE molam_export_sections IS 'Available sections for export (for UI selection)';

INSERT INTO molam_export_sections (section_key, section_name, description, requires_module, data_sensitivity) VALUES
  ('profile', 'Profile Information', 'Basic profile data: name, email, phone, preferences', NULL, 'high'),
  ('badges', 'Badges & Achievements', 'All badges earned across subsidiaries', NULL, 'low'),
  ('activity', 'Activity History', 'Recent activity feed (last 90 days, anonymized)', NULL, 'medium'),
  ('media', 'Media Assets', 'Uploaded photos, avatars, banners', NULL, 'medium'),
  ('privacy', 'Privacy Settings', 'Current privacy preferences and settings', NULL, 'low'),
  ('devices', 'Connected Devices', 'List of trusted devices and sessions', NULL, 'medium'),
  ('transactions_pay', 'Payment Transactions', 'MolamPay transaction history', 'pay', 'critical'),
  ('orders_eats', 'Food Orders', 'MolamEats order history', 'eats', 'medium'),
  ('orders_shop', 'Shopping Orders', 'MolamShop order history', 'shop', 'medium'),
  ('kyc', 'KYC Documents', 'Identity verification documents', NULL, 'critical');

-- =====================================================
-- 3. EXPORT AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_export_audit (
  audit_id          BIGSERIAL PRIMARY KEY,
  export_id         BIGINT NOT NULL REFERENCES molam_profile_exports(export_id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Event
  event_type        VARCHAR(50) NOT NULL,  -- requested, processing_started, completed, downloaded, failed, expired, deleted
  event_timestamp   TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  actor_id          UUID REFERENCES molam_users(user_id),  -- Who performed the action
  ip_address        INET,
  user_agent        TEXT,

  -- Details
  details           JSONB DEFAULT '{}',

  -- Compliance
  retention_until   TIMESTAMPTZ  -- How long to keep this audit record
);

CREATE INDEX idx_export_audit_export ON molam_export_audit(export_id, event_timestamp);
CREATE INDEX idx_export_audit_user ON molam_export_audit(user_id, event_timestamp DESC);
CREATE INDEX idx_export_audit_event ON molam_export_audit(event_type, event_timestamp DESC);

COMMENT ON TABLE molam_export_audit IS 'Complete audit trail for all export operations (GDPR compliance)';

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Auto-log export events
CREATE OR REPLACE FUNCTION log_export_event()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO molam_export_audit (export_id, user_id, event_type, actor_id, ip_address, details)
    VALUES (
      NEW.export_id,
      NEW.user_id,
      'requested',
      COALESCE(NEW.requested_by, NEW.user_id),
      NEW.ip_address,
      jsonb_build_object('format', NEW.format, 'sections', NEW.include_sections)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Log status changes
    IF (OLD.status != NEW.status) THEN
      INSERT INTO molam_export_audit (export_id, user_id, event_type, details)
      VALUES (
        NEW.export_id,
        NEW.user_id,
        CASE NEW.status
          WHEN 'processing' THEN 'processing_started'
          WHEN 'ready' THEN 'completed'
          WHEN 'failed' THEN 'failed'
          WHEN 'expired' THEN 'expired'
          ELSE 'status_changed'
        END,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'error', NEW.error_message)
      );
    END IF;

    -- Log downloads
    IF (NEW.downloaded_count > OLD.downloaded_count) THEN
      INSERT INTO molam_export_audit (export_id, user_id, event_type, details)
      VALUES (
        NEW.export_id,
        NEW.user_id,
        'downloaded',
        jsonb_build_object('download_count', NEW.downloaded_count)
      );
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_export_audit
  AFTER INSERT OR UPDATE ON molam_profile_exports
  FOR EACH ROW EXECUTE FUNCTION log_export_event();

-- Auto-set expiration date
CREATE OR REPLACE FUNCTION set_export_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'ready' AND NEW.expires_at IS NULL) THEN
    -- Default: 7 days expiration
    NEW.expires_at := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_export_expiration
  BEFORE UPDATE ON molam_profile_exports
  FOR EACH ROW
  WHEN (NEW.status = 'ready')
  EXECUTE FUNCTION set_export_expiration();

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Request new export
CREATE OR REPLACE FUNCTION request_profile_export(
  p_user_id UUID,
  p_format VARCHAR,
  p_sections JSONB DEFAULT '["profile", "badges", "activity"]',
  p_requested_by UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_export_id BIGINT;
BEGIN
  -- Check for recent pending exports (rate limiting)
  IF EXISTS (
    SELECT 1 FROM molam_profile_exports
    WHERE user_id = p_user_id
      AND status IN ('pending', 'processing')
      AND requested_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RAISE EXCEPTION 'export_rate_limit_exceeded' USING HINT = 'Wait 5 minutes between export requests';
  END IF;

  INSERT INTO molam_profile_exports (
    user_id, format, include_sections, requested_by, ip_address, user_agent
  ) VALUES (
    p_user_id, p_format, p_sections, p_requested_by, p_ip_address, p_user_agent
  ) RETURNING export_id INTO v_export_id;

  RETURN v_export_id;
END;
$$ LANGUAGE plpgsql;

-- Get export status
CREATE OR REPLACE FUNCTION get_export_status(
  p_export_id BIGINT,
  p_user_id UUID
) RETURNS TABLE(
  export_id BIGINT,
  format VARCHAR,
  status VARCHAR,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  storage_size BIGINT,
  downloaded_count INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.export_id,
    e.format,
    e.status,
    e.requested_at,
    e.completed_at,
    e.expires_at,
    e.storage_size,
    e.downloaded_count,
    e.error_message
  FROM molam_profile_exports e
  WHERE e.export_id = p_export_id
    AND e.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Mark as downloaded
CREATE OR REPLACE FUNCTION mark_export_downloaded(
  p_export_id BIGINT,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE molam_profile_exports
  SET downloaded_count = downloaded_count + 1,
      last_downloaded_at = NOW()
  WHERE export_id = p_export_id
    AND user_id = p_user_id
    AND status = 'ready';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark as expired
  UPDATE molam_profile_exports
  SET status = 'expired'
  WHERE status = 'ready'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log cleanup
  INSERT INTO molam_export_audit (export_id, user_id, event_type, details)
  SELECT export_id, user_id, 'expired', jsonb_build_object('cleanup_date', NOW())
  FROM molam_profile_exports
  WHERE status = 'expired'
    AND expires_at < NOW() - INTERVAL '1 day';

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Get pending exports for worker
CREATE OR REPLACE FUNCTION get_pending_exports(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  export_id BIGINT,
  user_id UUID,
  format VARCHAR,
  include_sections JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.export_id,
    e.user_id,
    e.format,
    e.include_sections
  FROM molam_profile_exports e
  WHERE e.status = 'pending'
    AND (e.retry_count < 3 OR e.retry_count IS NULL)
  ORDER BY e.requested_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;  -- Prevent concurrent processing
END;
$$ LANGUAGE plpgsql;

-- Update export status
CREATE OR REPLACE FUNCTION update_export_status(
  p_export_id BIGINT,
  p_status VARCHAR,
  p_storage_key TEXT DEFAULT NULL,
  p_storage_size BIGINT DEFAULT NULL,
  p_checksum TEXT DEFAULT NULL,
  p_signature TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE molam_profile_exports
  SET status = p_status,
      processing_started_at = CASE WHEN p_status = 'processing' THEN NOW() ELSE processing_started_at END,
      completed_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE completed_at END,
      storage_key = COALESCE(p_storage_key, storage_key),
      storage_size = COALESCE(p_storage_size, storage_size),
      checksum_sha256 = COALESCE(p_checksum, checksum_sha256),
      signature_hmac = COALESCE(p_signature, signature_hmac),
      error_message = COALESCE(p_error, error_message),
      retry_count = CASE WHEN p_status = 'failed' THEN retry_count + 1 ELSE retry_count END
  WHERE export_id = p_export_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get export statistics
CREATE OR REPLACE FUNCTION get_export_statistics(
  p_user_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE(
  total_exports BIGINT,
  ready_exports BIGINT,
  failed_exports BIGINT,
  expired_exports BIGINT,
  json_exports BIGINT,
  pdf_exports BIGINT,
  total_size_bytes BIGINT,
  total_downloads BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_exports,
    COUNT(*) FILTER (WHERE status = 'ready')::BIGINT AS ready_exports,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_exports,
    COUNT(*) FILTER (WHERE status = 'expired')::BIGINT AS expired_exports,
    COUNT(*) FILTER (WHERE format = 'json')::BIGINT AS json_exports,
    COUNT(*) FILTER (WHERE format = 'pdf')::BIGINT AS pdf_exports,
    COALESCE(SUM(storage_size), 0)::BIGINT AS total_size_bytes,
    COALESCE(SUM(downloaded_count), 0)::BIGINT AS total_downloads
  FROM molam_profile_exports
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND requested_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. VIEWS
-- =====================================================

-- Active exports view
CREATE OR REPLACE VIEW v_active_exports AS
SELECT
  e.export_id,
  e.user_id,
  u.email,
  e.format,
  e.status,
  e.requested_at,
  e.completed_at,
  e.expires_at,
  e.storage_size,
  e.downloaded_count,
  CASE
    WHEN e.status = 'ready' AND e.expires_at > NOW() THEN true
    ELSE false
  END AS is_downloadable
FROM molam_profile_exports e
JOIN molam_users u ON e.user_id = u.user_id
WHERE e.status IN ('pending', 'processing', 'ready')
  AND (e.expires_at IS NULL OR e.expires_at > NOW());

-- Export statistics by user
CREATE OR REPLACE VIEW v_export_stats_by_user AS
SELECT
  user_id,
  COUNT(*) AS total_exports,
  COUNT(*) FILTER (WHERE status = 'ready') AS completed_exports,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_exports,
  SUM(downloaded_count) AS total_downloads,
  MAX(requested_at) AS last_export_at,
  SUM(storage_size) AS total_storage_bytes
FROM molam_profile_exports
GROUP BY user_id;

-- =====================================================
-- 7. ROW-LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE molam_profile_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_export_audit ENABLE ROW LEVEL SECURITY;

-- Users can only see their own exports
CREATE POLICY exports_select_own ON molam_profile_exports
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY exports_insert_own ON molam_profile_exports
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Users can only see their own audit logs
CREATE POLICY export_audit_select_own ON molam_export_audit
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- =====================================================
-- 8. SCHEDULED CLEANUP JOB
-- =====================================================

-- This should be called by cron/scheduler daily
-- Example: SELECT cleanup_expired_exports();

COMMENT ON FUNCTION cleanup_expired_exports IS 'Daily job to mark expired exports and cleanup old files. Run via cron: 0 2 * * * psql -c "SELECT cleanup_expired_exports()"';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
