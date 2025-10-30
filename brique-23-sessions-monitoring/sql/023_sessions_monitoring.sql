-- Brique 23: Sessions Monitoring
CREATE TABLE IF NOT EXISTS molam_sessions_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES molam_tenants(id) ON DELETE CASCADE,
  module_scope TEXT NOT NULL CHECK (module_scope IN ('id','pay','eats','talk','ads','shop','free')),
  device_id TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios','android','web','desktop','ussd','api')),
  os_version TEXT NULL,
  app_version TEXT NULL,
  ip_address INET NOT NULL,
  geo_country TEXT NULL,
  geo_city TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  terminated_reason TEXT NULL,
  risk_score SMALLINT DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100)
);

CREATE INDEX idx_sessions_user ON molam_sessions_active(user_id, is_active);
CREATE INDEX idx_sessions_tenant ON molam_sessions_active(tenant_id, module_scope);
CREATE INDEX idx_sessions_device ON molam_sessions_active(device_id);
CREATE INDEX idx_sessions_last_seen ON molam_sessions_active(last_seen DESC) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS molam_session_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES molam_sessions_active(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  anomaly_type TEXT NOT NULL,
  details JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomalies_user ON molam_session_anomalies(user_id);
CREATE INDEX idx_anomalies_session ON molam_session_anomalies(session_id);

CREATE OR REPLACE FUNCTION detect_session_anomalies(p_user_id UUID, p_ip INET, p_geo_country TEXT)
RETURNS TABLE(anomaly_type TEXT, severity TEXT) LANGUAGE plpgsql AS $$
DECLARE
  active_count INT;
  country_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count FROM molam_sessions_active
  WHERE user_id = p_user_id AND is_active = TRUE;

  SELECT COUNT(DISTINCT geo_country) INTO country_count FROM molam_sessions_active
  WHERE user_id = p_user_id AND is_active = TRUE AND created_at > NOW() - INTERVAL '10 minutes';

  IF active_count > 5 THEN
    anomaly_type := 'excessive_sessions'; severity := 'high';
    RETURN NEXT;
  END IF;

  IF country_count >= 3 THEN
    anomaly_type := 'multi_country'; severity := 'critical';
    RETURN NEXT;
  END IF;
END $$;

CREATE OR REPLACE VIEW v_active_sessions AS
SELECT s.id, s.user_id, u.email, s.device_type, s.ip_address, s.geo_country, s.last_seen,
       EXTRACT(EPOCH FROM (NOW() - s.last_seen)) AS idle_seconds
FROM molam_sessions_active s
JOIN molam_users u ON u.id = s.user_id
WHERE s.is_active = TRUE
ORDER BY s.last_seen DESC;
