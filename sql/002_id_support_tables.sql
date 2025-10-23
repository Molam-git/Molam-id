-- Table des rôles
CREATE TABLE IF NOT EXISTS molam_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des sessions
CREATE TABLE IF NOT EXISTS molam_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- Table des logs d'audit
CREATE TABLE IF NOT EXISTS molam_audit_logs (
    id SERIAL PRIMARY KEY,
    actor INTEGER REFERENCES molam_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target_id INTEGER,
    meta JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des tokens révoqués
CREATE TABLE IF NOT EXISTS molam_revoked_tokens (
    id SERIAL PRIMARY KEY,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    revoked_at TIMESTAMP DEFAULT NOW()
);

-- Table des codes de vérification
CREATE TABLE IF NOT EXISTS molam_verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table d'authentification utilisateur
CREATE TABLE IF NOT EXISTS molam_user_auth (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des documents KYC
CREATE TABLE IF NOT EXISTS molam_kyc_docs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    doc_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sessions_user ON molam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON molam_audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_verification_user ON molam_verification_codes(user_id);