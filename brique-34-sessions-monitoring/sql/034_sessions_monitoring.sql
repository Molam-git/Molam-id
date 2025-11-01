-- =============================================================================
-- Brique 34 — Monitoring des sessions actives
-- =============================================================================
-- Objectif: Monitoring temps réel des sessions Molam ID pour tous les canaux
-- (Mobile, Web, USSD, API) avec corrélation device fingerprint + géolocalisation
-- =============================================================================

-- Base sessions table (if not already created in Brique 3, we harden/extend)
CREATE TABLE IF NOT EXISTS molam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('external','employee')),
  channel TEXT NOT NULL CHECK (channel IN ('mobile','web','ussd','api')),
  device_id TEXT,                    -- from device fingerprint pipeline
  device_fingerprint JSONB,          -- normalized fingerprint
  ip INET,
  user_agent TEXT,
  geo_country TEXT,
  geo_region TEXT,
  geo_city TEXT,
  timezone TEXT,
  login_method TEXT,                 -- password, otp, oauth, biometric
  mfa_level TEXT,                    -- none|sms|email|app|webauthn
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,   -- rolling expiration
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revocation_reason TEXT,
  revoked_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON molam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON molam_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON molam_sessions(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON molam_sessions(channel);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON molam_sessions(expires_at);

-- Session activity (append-only)
CREATE TABLE IF NOT EXISTS molam_session_activity (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES molam_sessions(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event TEXT NOT NULL,               -- HEARTBEAT|AUTH_SUCCESS|AUTH_FAIL|MFA_CHALLENGE|MFA_FAIL|LOGOUT|ANOMALY|REVOKE
  meta JSONB
);

-- Index for querying session activity
CREATE INDEX IF NOT EXISTS idx_session_activity_session_id ON molam_session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_at ON molam_session_activity(at DESC);
CREATE INDEX IF NOT EXISTS idx_session_activity_event ON molam_session_activity(event);

-- Detected anomalies
CREATE TABLE IF NOT EXISTS molam_session_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES molam_sessions(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,                -- IMPOSSIBLE_TRAVEL|FP_MISMATCH|BRUTEFORCE|UNUSUAL_CHANNEL|GEO_BLOCK
  severity TEXT NOT NULL,            -- low|medium|high|critical
  details JSONB,
  sira_ticket_id TEXT                -- optional reference created in SIRA
);

-- Indexes for anomaly querying
CREATE INDEX IF NOT EXISTS idx_session_anomalies_session_id ON molam_session_anomalies(session_id);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_detected_at ON molam_session_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_severity ON molam_session_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_session_anomalies_kind ON molam_session_anomalies(kind);

-- Policy table for anomaly thresholds
CREATE TABLE IF NOT EXISTS id_session_policies (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defaults
INSERT INTO id_session_policies(key, value) VALUES
 ('idle_timeout', '{"minutes": 30}'),
 ('absolute_timeout', '{"hours": 720}'),               -- 30 days
 ('max_failed_mfa_hour', '{"count": 5}'),
 ('impossible_travel', '{"kmh_threshold": 900}'),
 ('fp_mismatch_tolerance', '{"score_min": 0.85}')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;

-- WORM-like audit for critical admin/user actions
CREATE TABLE IF NOT EXISTS id_session_worm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user UUID,                   -- who triggered (user/admin/system)
  action TEXT NOT NULL,              -- SESSION_REVOKE|SESSIONS_REVOKE_ALL|POLICY_UPDATE
  session_id UUID,
  payload JSONB,
  signature BYTEA,
  ip INET,
  user_agent TEXT
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_session_worm_audit_at ON id_session_worm_audit(at DESC);
CREATE INDEX IF NOT EXISTS idx_session_worm_audit_actor ON id_session_worm_audit(actor_user);
CREATE INDEX IF NOT EXISTS idx_session_worm_audit_action ON id_session_worm_audit(action);

-- Function to automatically expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions() RETURNS void AS $$
BEGIN
  UPDATE molam_sessions
  SET is_active = FALSE,
      revocation_reason = 'auto_expired',
      revoked_at = NOW()
  WHERE is_active = TRUE
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE molam_sessions IS 'Brique 34 - Active sessions tracking for all channels';
COMMENT ON TABLE molam_session_activity IS 'Brique 34 - Append-only activity log for sessions';
COMMENT ON TABLE molam_session_anomalies IS 'Brique 34 - Detected security anomalies';
COMMENT ON TABLE id_session_policies IS 'Brique 34 - Configurable policies for session management';
COMMENT ON TABLE id_session_worm_audit IS 'Brique 34 - WORM-style audit trail for critical actions';
