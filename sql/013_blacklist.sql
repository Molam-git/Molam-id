-- Brique 13: Blacklist Schema
-- Protection anti-fraude et blocage d'accès

-- Table principale de blacklist
CREATE TABLE IF NOT EXISTS molam_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'ip', 'email', 'phone', 'device', 'user'
    value VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    expires_at TIMESTAMPTZ, -- NULL = permanent
    created_by UUID REFERENCES molam_users(id), -- Admin qui a blacklisté
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type, value),
    INDEX idx_blacklist_type (type),
    INDEX idx_blacklist_value (value),
    INDEX idx_blacklist_expires (expires_at)
);

-- Table pour tentatives de login échouées (auto-blacklist)
CREATE TABLE IF NOT EXISTS molam_failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- email, phone, ou IP
    identifier_type VARCHAR(20) NOT NULL, -- 'email', 'phone', 'ip'
    ip_address INET,
    user_agent TEXT,
    failure_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_failed_login_identifier (identifier),
    INDEX idx_failed_login_ip (ip_address),
    INDEX idx_failed_login_created (created_at)
);

-- Table pour logs de blocages
CREATE TABLE IF NOT EXISTS molam_blacklist_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blacklist_id UUID REFERENCES molam_blacklist(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'blocked', 'allowed', 'added', 'removed'
    blocked_type VARCHAR(50),
    blocked_value VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_blacklist_logs_created (created_at),
    INDEX idx_blacklist_logs_action (action)
);

-- Commentaires
COMMENT ON TABLE molam_blacklist IS 'Liste des entités bloquées (IP, email, phone, device, user)';
COMMENT ON TABLE molam_failed_login_attempts IS 'Tentatives de connexion échouées pour auto-blacklist';
COMMENT ON TABLE molam_blacklist_logs IS 'Historique des blocages et actions';
COMMENT ON COLUMN molam_blacklist.expires_at IS 'Date d''expiration du blacklist (NULL = permanent)';
COMMENT ON COLUMN molam_blacklist.severity IS 'Niveau de sévérité: low, medium, high, critical';
