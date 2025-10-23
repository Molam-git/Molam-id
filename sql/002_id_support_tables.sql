-- ============================================================================
-- Brique 2 - Tables de support pour ID (UUID compatible)
-- Tables : sessions, audit logs, tokens révoqués, codes de vérification
-- ============================================================================

-- ============================================================================
-- Table: molam_sessions
-- Purpose: Gestion des sessions utilisateur avec refresh tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    device_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON molam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON molam_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON molam_sessions(device_id);

-- ============================================================================
-- Table: molam_audit_logs
-- Purpose: Logs d'audit pour traçabilité des actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES molam_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON molam_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON molam_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON molam_audit_logs(created_at);

-- ============================================================================
-- Table: molam_revoked_tokens
-- Purpose: Liste des tokens révoqués (pour logout immédiat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_revoked_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_hash ON molam_revoked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON molam_revoked_tokens(expires_at);

-- ============================================================================
-- Table: molam_verification_codes
-- Purpose: Codes OTP pour vérification (email, SMS, 2FA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    type TEXT NOT NULL, -- email, sms, 2fa
    channel TEXT, -- email or phone number
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_user ON molam_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_expires ON molam_verification_codes(expires_at);

-- ============================================================================
-- Table: molam_user_auth
-- Purpose: Authentification via fournisseurs externes (OAuth, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_user_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_user ON molam_user_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_provider ON molam_user_auth(provider, provider_id);

-- ============================================================================
-- Table: molam_kyc_docs
-- Purpose: Documents KYC (Know Your Customer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_kyc_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL, -- id_card, passport, proof_of_address, etc.
    doc_url TEXT NOT NULL,
    doc_number TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by UUID REFERENCES molam_users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    ocr_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_user ON molam_kyc_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_status ON molam_kyc_docs(status);

-- ============================================================================
-- Cleanup function for expired data
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Clean expired revoked tokens (after expiration)
  DELETE FROM molam_revoked_tokens WHERE expires_at < NOW();

  -- Clean old verification codes (7 days)
  DELETE FROM molam_verification_codes WHERE created_at < NOW() - INTERVAL '7 days';

  -- Clean old audit logs (keep 90 days)
  DELETE FROM molam_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE molam_sessions IS 'User sessions with refresh tokens and device tracking';
COMMENT ON TABLE molam_audit_logs IS 'Audit trail of all user actions';
COMMENT ON TABLE molam_revoked_tokens IS 'Revoked tokens for immediate logout';
COMMENT ON TABLE molam_verification_codes IS 'OTP codes for email/SMS verification';
COMMENT ON TABLE molam_user_auth IS 'External OAuth provider authentication';
COMMENT ON TABLE molam_kyc_docs IS 'KYC documents for identity verification';
