-- Brique 10: Device Fingerprinting Schema
-- Identification unique des appareils pour détection d'anomalies

-- Table principale des devices
CREATE TABLE IF NOT EXISTS molam_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_fingerprint VARCHAR(255) UNIQUE NOT NULL, -- Hash unique du device
    user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,

    -- Informations de l'appareil
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet', 'unknown'
    os VARCHAR(100),
    os_version VARCHAR(50),
    browser VARCHAR(100),
    browser_version VARCHAR(50),
    screen_resolution VARCHAR(50),
    timezone VARCHAR(100),
    language VARCHAR(50),

    -- Réseau
    ip_address INET,
    country VARCHAR(2),
    city VARCHAR(100),

    -- Metadata
    user_agent TEXT,
    metadata JSONB, -- Canvas fingerprint, WebGL, etc.

    -- Trust level
    trust_level VARCHAR(20) DEFAULT 'unknown', -- 'trusted', 'suspicious', 'blocked', 'unknown'
    trust_score INTEGER DEFAULT 50, -- 0-100

    -- Timestamps
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON molam_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON molam_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_trust_level ON molam_devices(trust_level);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON molam_devices(ip_address);

-- Table pour historique des connexions par device
CREATE TABLE IF NOT EXISTS molam_device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES molam_devices(id) ON DELETE CASCADE,
    session_id UUID REFERENCES molam_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,

    -- Informations de connexion
    ip_address INET,
    country VARCHAR(2),
    city VARCHAR(100),

    -- Anomalies détectées
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_reasons TEXT[], -- ['new_location', 'unusual_time', 'suspicious_behavior']
    risk_score INTEGER DEFAULT 0, -- 0-100

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour device sessions
CREATE INDEX IF NOT EXISTS idx_device_sessions_device ON molam_device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON molam_device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_anomaly ON molam_device_sessions(anomaly_detected);
CREATE INDEX IF NOT EXISTS idx_device_sessions_created ON molam_device_sessions(created_at);

-- Table pour tracking des changements de devices
CREATE TABLE IF NOT EXISTS molam_device_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES molam_devices(id) ON DELETE CASCADE,

    change_type VARCHAR(50) NOT NULL, -- 'new_device', 'device_updated', 'trust_changed'
    old_value JSONB,
    new_value JSONB,

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(50), -- 'email', 'sms', 'totp', 'auto'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour device changes
CREATE INDEX IF NOT EXISTS idx_device_changes_user ON molam_device_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_device_changes_device ON molam_device_changes(device_id);
CREATE INDEX IF NOT EXISTS idx_device_changes_verified ON molam_device_changes(verified);

-- Commentaires
COMMENT ON TABLE molam_devices IS 'Devices uniques identifiés par fingerprinting';
COMMENT ON TABLE molam_device_sessions IS 'Historique des connexions par device avec détection d''anomalies';
COMMENT ON TABLE molam_device_changes IS 'Tracking des changements de devices nécessitant vérification';
COMMENT ON COLUMN molam_devices.trust_score IS 'Score de confiance 0-100 basé sur l''historique';
COMMENT ON COLUMN molam_device_sessions.anomaly_reasons IS 'Raisons de détection d''anomalie (nouvelle localisation, horaire inhabituel, etc.)';
