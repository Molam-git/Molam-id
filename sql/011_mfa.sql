-- Brique 11: MFA/2FA Schema
-- Multi-Factor Authentication avec TOTP

-- Ajouter colonnes MFA à molam_users
ALTER TABLE molam_users
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[], -- Array de codes de secours
ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;

-- Table pour les codes de récupération utilisés
CREATE TABLE IF NOT EXISTS molam_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_mfa_recovery_user (user_id)
);

-- Table pour historique MFA
CREATE TABLE IF NOT EXISTS molam_mfa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'enabled', 'disabled', 'verified', 'failed', 'recovery_used'
    success BOOLEAN DEFAULT TRUE,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_mfa_logs_user (user_id),
    INDEX idx_mfa_logs_created (created_at)
);

-- Commentaires
COMMENT ON COLUMN molam_users.mfa_enabled IS 'Si l''utilisateur a activé la 2FA';
COMMENT ON COLUMN molam_users.mfa_secret IS 'Secret TOTP crypté (base32)';
COMMENT ON COLUMN molam_users.mfa_backup_codes IS 'Codes de récupération hashés';
COMMENT ON TABLE molam_mfa_logs IS 'Historique des actions MFA pour audit';
