-- Brique 6: Password Reset Schema
-- Réinitialisation sécurisée du mot de passe par email

-- Table pour les tokens de réinitialisation
CREATE TABLE IF NOT EXISTS molam_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_password_reset_user (user_id),
    INDEX idx_password_reset_token (token_hash),
    INDEX idx_password_reset_expires (expires_at)
);

-- Table pour historique de changements de mot de passe
CREATE TABLE IF NOT EXISTS molam_password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    changed_by VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'reset'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_password_history_user (user_id),
    INDEX idx_password_history_created (created_at)
);

-- Commentaires
COMMENT ON TABLE molam_password_reset_tokens IS 'Tokens temporaires pour réinitialisation mot de passe';
COMMENT ON TABLE molam_password_history IS 'Historique des changements de mot de passe pour audit';
COMMENT ON COLUMN molam_password_reset_tokens.token_hash IS 'Hash SHA256 du token envoyé par email';
COMMENT ON COLUMN molam_password_reset_tokens.expires_at IS 'Expiration token (15-30 min recommandé)';
