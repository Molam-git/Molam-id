
CREATE TABLE molam_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  molam_id TEXT NOT NULL UNIQUE,                      -- Public, human-readable, immutable (ex: MOLAM-SN-00000123)
  phone_e164 TEXT UNIQUE,                             -- Normalized phone in E.164 (+221...)
  email TEXT UNIQUE,                                -- Email (case-insensitive)
  password_hash TEXT,                                 -- Argon2id hash
  ussd_pin_hash TEXT,                                 -- USSD PIN hash (never plaintext)
  role_profile TEXT[] NOT NULL DEFAULT ARRAY['client']::text[], -- Roles array (client, agent, merchant, admin, etc.)
  status TEXT NOT NULL DEFAULT 'pending',             -- pending, active, suspended, closed
  lang_pref TEXT NOT NULL DEFAULT 'en',               -- Language preference
  currency_pref TEXT NOT NULL DEFAULT 'USD',          -- Currency preference
  kyc_status TEXT NOT NULL DEFAULT 'none',            -- none, initiated, verified, rejected
  kyc_reference TEXT,                                 -- External KYC system reference
  metadata JSONB DEFAULT '{}'::jsonb,                 -- Extensible metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_molam_users_phone ON molam_users (phone_e164);
CREATE INDEX idx_molam_users_status ON molam_users (status);
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
-- Migration Brique 4 : Onboarding & KYC

-- 1. Ajout de colonnes à molam_users
ALTER TABLE molam_users
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS is_kyc_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_level TEXT DEFAULT 'P0',
  ADD COLUMN IF NOT EXISTS kyc_provider TEXT,
  ADD COLUMN IF NOT EXISTS kyc_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS ussd_pin_hash TEXT;

-- Index sur les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_users_user_type ON molam_users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_kyc_level ON molam_users(kyc_level);

-- 2. Mise à jour de la table molam_kyc_docs (si elle existe déjà)
DROP TABLE IF EXISTS molam_kyc_docs CASCADE;
CREATE TABLE molam_kyc_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  storage_key_id TEXT,
  content_hash TEXT NOT NULL,
  ocr_data JSONB,
  status TEXT DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_kyc_docs_user ON molam_kyc_docs(user_id);
CREATE INDEX idx_kyc_docs_status ON molam_kyc_docs(status);

-- 3. Mise à jour de la table molam_verification_codes
DROP TABLE IF EXISTS molam_verification_codes CASCADE;
CREATE TABLE molam_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES molam_users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL,
  nonce TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_verification_phone ON molam_verification_codes(phone);
CREATE INDEX idx_verification_email ON molam_verification_codes(email);
CREATE INDEX idx_verification_expires ON molam_verification_codes(expires_at);

-- 4. Mise à jour de la table molam_sessions
ALTER TABLE molam_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_sessions_device ON molam_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON molam_sessions(expires_at);

-- 5. Mise à jour de molam_roles
ALTER TABLE molam_roles
  ADD COLUMN IF NOT EXISTS granted_by INTEGER REFERENCES molam_users(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 6. Table de rate limiting (alternative à Redis pour démarrer)
CREATE TABLE IF NOT EXISTS molam_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rate_limits_key ON molam_rate_limits(key, type);
CREATE INDEX idx_rate_limits_expires ON molam_rate_limits(expires_at);

-- 7. Table pour les webhooks reçus (replay protection)
CREATE TABLE IF NOT EXISTS molam_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_webhook_event_id ON molam_webhook_events(event_id);
CREATE INDEX idx_webhook_status ON molam_webhook_events(status);-- ========================================
-- BRIQUE 6: RBAC & AuthZ Service
-- ========================================

-- 1. Catalogue des rôles de haut niveau (avec héritage possible)
CREATE TABLE IF NOT EXISTS molam_roles_catalog (
  id SERIAL PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,  -- ex: 'pay_admin', 'pay_agent', 'shop_vendor'
  module TEXT NOT NULL,             -- 'pay','talk','eats','ads','shop','free','id'
  description TEXT,
  parent_role TEXT REFERENCES molam_roles_catalog(role_name),  -- héritage de rôle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_catalog_module ON molam_roles_catalog(module);
CREATE INDEX IF NOT EXISTS idx_roles_catalog_role_name ON molam_roles_catalog(role_name);

-- 2. Attribution des rôles aux utilisateurs
CREATE TABLE IF NOT EXISTS molam_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL REFERENCES molam_roles_catalog(role_name),
  module TEXT NOT NULL,              -- 'pay','talk','eats','ads','shop','free','id'
  trusted_level INT DEFAULT 10,      -- 0=low, 100=superadmin
  granted_by UUID REFERENCES molam_users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,  -- expiration optionnelle du rôle
  metadata JSONB DEFAULT '{}'::jsonb,   -- métadonnées additionnelles

  CONSTRAINT unique_user_role_module UNIQUE(user_id, role_name, module)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON molam_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_module ON molam_user_roles(module);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_name ON molam_user_roles(role_name);

-- 3. Policies spécifiques (ABAC - Attribute-Based Access Control)
CREATE TABLE IF NOT EXISTS molam_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,              -- module concerné
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  priority INT DEFAULT 100,          -- plus bas = plus prioritaire
  condition JSONB DEFAULT '{}'::jsonb,  -- conditions ABAC
  -- Exemples de conditions:
  -- {"country":"SN","kyc_level":"P2","hour":{"gte":6,"lte":20}}
  -- {"sira_score":{"gte":60},"device_trusted":true}
  resources TEXT[],                  -- ressources concernées (paths)
  actions TEXT[],                    -- actions autorisées (GET, POST, etc)
  enabled BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID REFERENCES molam_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_module ON molam_policies(module);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON molam_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON molam_policies(priority);

-- 4. Décisions d'autorisation (audit trail)
CREATE TABLE IF NOT EXISTS molam_authz_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id TEXT UNIQUE NOT NULL,     -- ID pour traçabilité
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  module TEXT,
  roles TEXT[],
  policies_applied UUID[],           -- IDs des policies appliquées
  context JSONB DEFAULT '{}'::jsonb, -- contexte de la décision
  reason TEXT,                       -- raison de la décision
  ttl INT DEFAULT 300,               -- durée de validité en cache (secondes)
  ip_address TEXT,
  user_agent TEXT,
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE  -- decided_at + ttl
);

CREATE INDEX IF NOT EXISTS idx_authz_decisions_user ON molam_authz_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_audit ON molam_authz_decisions(audit_id);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_decided_at ON molam_authz_decisions(decided_at);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_module ON molam_authz_decisions(module);

-- 5. Cache des décisions AuthZ (pour performance)
CREATE TABLE IF NOT EXISTS molam_authz_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,    -- hash(user_id + path + method + context)
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  audit_id TEXT,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authz_cache_expires ON molam_authz_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_authz_cache_key ON molam_authz_cache(cache_key);

-- 6. Permissions granulaires (optionnel - pour RBAC très fin)
CREATE TABLE IF NOT EXISTS molam_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name TEXT UNIQUE NOT NULL,  -- ex: 'pay:transfer:create'
  module TEXT NOT NULL,
  resource TEXT NOT NULL,                -- ex: 'transfer', 'account'
  action TEXT NOT NULL,                  -- ex: 'create', 'read', 'update', 'delete'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON molam_permissions(module);

-- 7. Association rôles <-> permissions
CREATE TABLE IF NOT EXISTS molam_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL REFERENCES molam_roles_catalog(role_name) ON DELETE CASCADE,
  permission_name TEXT NOT NULL REFERENCES molam_permissions(permission_name) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT unique_role_permission UNIQUE(role_name, permission_name)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON molam_role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON molam_role_permissions(permission_name);

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour nettoyer le cache expiré
CREATE OR REPLACE FUNCTION cleanup_authz_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM molam_authz_cache WHERE expires_at < now();
  DELETE FROM molam_authz_decisions WHERE expires_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir tous les rôles d'un utilisateur (avec héritage)
CREATE OR REPLACE FUNCTION get_user_roles_with_inheritance(p_user_id UUID)
RETURNS TABLE(role_name TEXT, module TEXT, trusted_level INT) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE role_hierarchy AS (
    -- Rôles directs de l'utilisateur
    SELECT
      ur.role_name,
      ur.module,
      ur.trusted_level
    FROM molam_user_roles ur
    WHERE ur.user_id = p_user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > now())

    UNION

    -- Rôles hérités
    SELECT
      rc.parent_role,
      rh.module,
      rh.trusted_level
    FROM role_hierarchy rh
    JOIN molam_roles_catalog rc ON rh.role_name = rc.role_name
    WHERE rc.parent_role IS NOT NULL
  )
  SELECT DISTINCT * FROM role_hierarchy;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- DONNÉES INITIALES (Rôles de base)
-- ========================================

-- Rôles pour le module ID (identité)
INSERT INTO molam_roles_catalog (role_name, module, description) VALUES
  ('id_admin', 'id', 'Administrateur du système d''identité'),
  ('id_auditor', 'id', 'Auditeur - accès en lecture seule'),
  ('id_support', 'id', 'Support client - peut gérer les comptes utilisateurs'),
  ('id_user', 'id', 'Utilisateur standard')
ON CONFLICT (role_name) DO NOTHING;

-- Rôles pour le module PAY (paiements)
INSERT INTO molam_roles_catalog (role_name, module, description) VALUES
  ('pay_admin', 'pay', 'Administrateur Molam Pay'),
  ('pay_agent', 'pay', 'Agent de transfert'),
  ('pay_client', 'pay', 'Client standard'),
  ('pay_merchant', 'pay', 'Marchand'),
  ('pay_auditor', 'pay', 'Auditeur financier')
ON CONFLICT (role_name) DO NOTHING;

-- Rôles pour le module EATS (restauration)
INSERT INTO molam_roles_catalog (role_name, module, description) VALUES
  ('eats_admin', 'eats', 'Administrateur Molam Eats'),
  ('eats_restaurant', 'eats', 'Propriétaire de restaurant'),
  ('eats_driver', 'eats', 'Livreur'),
  ('eats_customer', 'eats', 'Client')
ON CONFLICT (role_name) DO NOTHING;

-- Rôles pour le module SHOP (e-commerce)
INSERT INTO molam_roles_catalog (role_name, module, description) VALUES
  ('shop_admin', 'shop', 'Administrateur Molam Shop'),
  ('shop_vendor', 'shop', 'Vendeur'),
  ('shop_customer', 'shop', 'Acheteur')
ON CONFLICT (role_name) DO NOTHING;

-- Permissions de base pour le module ID
INSERT INTO molam_permissions (permission_name, module, resource, action, description) VALUES
  ('id:users:read', 'id', 'users', 'read', 'Lire les informations utilisateur'),
  ('id:users:write', 'id', 'users', 'write', 'Modifier les informations utilisateur'),
  ('id:users:delete', 'id', 'users', 'delete', 'Supprimer des utilisateurs'),
  ('id:roles:read', 'id', 'roles', 'read', 'Lire les rôles'),
  ('id:roles:write', 'id', 'roles', 'write', 'Modifier les rôles'),
  ('id:sessions:read', 'id', 'sessions', 'read', 'Lire les sessions'),
  ('id:sessions:revoke', 'id', 'sessions', 'revoke', 'Révoquer des sessions')
ON CONFLICT (permission_name) DO NOTHING;

-- Permissions de base pour le module PAY
INSERT INTO molam_permissions (permission_name, module, resource, action, description) VALUES
  ('pay:transfer:create', 'pay', 'transfer', 'create', 'Créer un transfert'),
  ('pay:transfer:read', 'pay', 'transfer', 'read', 'Consulter un transfert'),
  ('pay:account:read', 'pay', 'account', 'read', 'Consulter un compte'),
  ('pay:account:write', 'pay', 'account', 'write', 'Modifier un compte')
ON CONFLICT (permission_name) DO NOTHING;

-- Association rôles <-> permissions (ID)
INSERT INTO molam_role_permissions (role_name, permission_name) VALUES
  ('id_admin', 'id:users:read'),
  ('id_admin', 'id:users:write'),
  ('id_admin', 'id:users:delete'),
  ('id_admin', 'id:roles:read'),
  ('id_admin', 'id:roles:write'),
  ('id_admin', 'id:sessions:read'),
  ('id_admin', 'id:sessions:revoke'),
  ('id_auditor', 'id:users:read'),
  ('id_auditor', 'id:roles:read'),
  ('id_auditor', 'id:sessions:read'),
  ('id_support', 'id:users:read'),
  ('id_support', 'id:users:write'),
  ('id_support', 'id:sessions:read'),
  ('id_user', 'id:users:read')
ON CONFLICT (role_name, permission_name) DO NOTHING;

-- Association rôles <-> permissions (PAY)
INSERT INTO molam_role_permissions (role_name, permission_name) VALUES
  ('pay_admin', 'pay:transfer:create'),
  ('pay_admin', 'pay:transfer:read'),
  ('pay_admin', 'pay:account:read'),
  ('pay_admin', 'pay:account:write'),
  ('pay_client', 'pay:transfer:create'),
  ('pay_client', 'pay:transfer:read'),
  ('pay_client', 'pay:account:read'),
  ('pay_auditor', 'pay:transfer:read'),
  ('pay_auditor', 'pay:account:read')
ON CONFLICT (role_name, permission_name) DO NOTHING;

-- Policies de base (exemples)
INSERT INTO molam_policies (name, module, effect, priority, condition, resources, actions, enabled) VALUES
  (
    'pay_transfer_requires_p2_kyc',
    'pay',
    'deny',
    10,
    '{"kyc_level": ["P0", "P1"]}'::jsonb,
    ARRAY['/api/pay/transfer'],
    ARRAY['POST'],
    true
  ),
  (
    'pay_admin_full_access',
    'pay',
    'allow',
    1,
    '{"roles": ["pay_admin"]}'::jsonb,
    ARRAY['/api/pay/**'],
    ARRAY['GET', 'POST', 'PUT', 'DELETE'],
    true
  ),
  (
    'sira_low_score_deny',
    'pay',
    'deny',
    5,
    '{"sira_score": {"lt": 40}}'::jsonb,
    ARRAY['/api/pay/transfer'],
    ARRAY['POST'],
    true
  ),
  (
    'business_hours_only',
    'pay',
    'deny',
    50,
    '{"hour": {"lt": 6, "gte": 22}}'::jsonb,
    ARRAY['/api/pay/transfer'],
    ARRAY['POST'],
    false  -- désactivé par défaut
  )
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- COMMENTAIRES
-- ========================================

COMMENT ON TABLE molam_roles_catalog IS 'Catalogue des rôles disponibles avec support d''héritage';
COMMENT ON TABLE molam_user_roles IS 'Attribution des rôles aux utilisateurs';
COMMENT ON TABLE molam_policies IS 'Policies ABAC pour contrôle d''accès dynamique';
COMMENT ON TABLE molam_authz_decisions IS 'Journal d''audit des décisions d''autorisation';
COMMENT ON TABLE molam_authz_cache IS 'Cache des décisions AuthZ pour performance';
COMMENT ON TABLE molam_permissions IS 'Permissions granulaires par module';
COMMENT ON TABLE molam_role_permissions IS 'Association entre rôles et permissions';
-- ============================================================================
-- Brique 9 — AuthZ ext_authz / Envoy integration (OPA-based)
-- ============================================================================
-- Centralized authorization for all Molam modules
-- RBAC (Role-Based Access Control) + ABAC (Attribute-Based Access Control)
-- Integration with Envoy ext_authz for distributed authorization
-- SIRA score integration for dynamic risk-based access control
-- ============================================================================

-- ============================================================================
-- Table: molam_roles
-- Purpose: Store user roles with module-level access control
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL, -- pay, eats, ads, talk, shop, free, id
  access_scope TEXT NOT NULL CHECK (access_scope IN ('read', 'write', 'admin')),
  trusted_level INTEGER DEFAULT 0 CHECK (trusted_level >= 0 AND trusted_level <= 100),
  granted_by UUID REFERENCES molam_users(id), -- Who granted this role
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  last_active TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_molam_roles_user_module ON molam_roles(user_id, module);
CREATE INDEX IF NOT EXISTS idx_molam_roles_module ON molam_roles(module);
CREATE INDEX IF NOT EXISTS idx_molam_roles_expires_at ON molam_roles(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- Table: molam_attributes
-- Purpose: Store dynamic user attributes for ABAC (Attribute-Based Access Control)
-- Examples: device_type=android, location=dakar, kyc_level=P2, last_login_country=SN
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  key TEXT NOT NULL, -- attribute name (e.g., 'device_type', 'kyc_level', 'country')
  value TEXT NOT NULL, -- attribute value (e.g., 'android', 'P2', 'SN')
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key) -- One value per key per user
);

-- Indexes for attribute lookups
CREATE INDEX IF NOT EXISTS idx_molam_attributes_user_id ON molam_attributes(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_attributes_key ON molam_attributes(key);
CREATE INDEX IF NOT EXISTS idx_molam_attributes_user_key ON molam_attributes(user_id, key);

-- ============================================================================
-- Table: molam_authz_audit
-- Purpose: Immutable audit log of all authorization decisions
-- Every allow/deny decision is logged with full context
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_authz_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- NULL for unauthenticated requests
  molam_id TEXT, -- User's public Molam ID
  module TEXT NOT NULL, -- pay, eats, ads, etc.
  action TEXT NOT NULL, -- transfer, read, create, delete, etc.
  resource TEXT, -- Specific resource being accessed (e.g., /api/pay/transfer)
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason TEXT, -- Why was this decision made
  policy_version TEXT NOT NULL, -- Version of policy applied (e.g., 'v1.0')
  context JSONB DEFAULT '{}', -- Full request context (device, IP, headers, etc.)
  sira_score INTEGER, -- SIRA risk score at time of decision
  latency_ms INTEGER, -- Decision latency in milliseconds
  cache_hit BOOLEAN DEFAULT false, -- Was this served from cache
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_user_id ON molam_authz_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_module ON molam_authz_audit(module);
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_decision ON molam_authz_audit(decision);
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_created_at ON molam_authz_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_user_module ON molam_authz_audit(user_id, module, created_at);

-- Composite index for common queries (user + module + time range)
CREATE INDEX IF NOT EXISTS idx_molam_authz_audit_composite
  ON molam_authz_audit(user_id, module, decision, created_at DESC);

-- ============================================================================
-- Table: molam_authz_cache
-- Purpose: Cache authorization decisions for performance (<5ms response time)
-- TTL-based expiration, invalidated on role/attribute changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_authz_cache (
  cache_key TEXT PRIMARY KEY, -- SHA256(user_id + module + action + context)
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason TEXT,
  policy_version TEXT NOT NULL,
  context_hash TEXT NOT NULL, -- Hash of context for invalidation
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for cache lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_molam_authz_cache_user_id ON molam_authz_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_authz_cache_expires_at ON molam_authz_cache(expires_at);

-- ============================================================================
-- Table: molam_policies
-- Purpose: Store OPA-style policies with versioning
-- Policies define authorization rules in a structured format
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- policy name (e.g., 'pay_transfer_kyc_p2')
  version TEXT NOT NULL, -- version (e.g., 'v1.0', 'v2.1')
  module TEXT NOT NULL, -- which module this policy applies to
  description TEXT,
  policy_content JSONB NOT NULL, -- Policy rules in JSON format
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Higher priority = evaluated first
  created_by UUID REFERENCES molam_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_molam_policies_module ON molam_policies(module);
CREATE INDEX IF NOT EXISTS idx_molam_policies_active ON molam_policies(is_active) WHERE is_active = true;

-- ============================================================================
-- Table: molam_role_hierarchy
-- Purpose: Define role inheritance (e.g., admin inherits from write)
-- ============================================================================
CREATE TABLE IF NOT EXISTS molam_role_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_scope TEXT NOT NULL, -- e.g., 'admin'
  child_scope TEXT NOT NULL, -- e.g., 'write'
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_scope, child_scope, module)
);

-- Default hierarchy: admin > write > read
INSERT INTO molam_role_hierarchy (parent_scope, child_scope, module) VALUES
  ('admin', 'write', 'pay'),
  ('write', 'read', 'pay'),
  ('admin', 'write', 'eats'),
  ('write', 'read', 'eats'),
  ('admin', 'write', 'ads'),
  ('write', 'read', 'ads'),
  ('admin', 'write', 'talk'),
  ('write', 'read', 'talk'),
  ('admin', 'write', 'shop'),
  ('write', 'read', 'shop'),
  ('admin', 'write', 'free'),
  ('write', 'read', 'free'),
  ('admin', 'write', 'id'),
  ('write', 'read', 'id')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Function: invalidate_authz_cache
-- Purpose: Invalidate cache when user roles or attributes change
-- ============================================================================
CREATE OR REPLACE FUNCTION invalidate_authz_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all cache entries for this user
  DELETE FROM molam_authz_cache WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-invalidate cache
DROP TRIGGER IF EXISTS trigger_invalidate_cache_on_role_change ON molam_roles;
CREATE TRIGGER trigger_invalidate_cache_on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON molam_roles
  FOR EACH ROW EXECUTE FUNCTION invalidate_authz_cache();

DROP TRIGGER IF EXISTS trigger_invalidate_cache_on_attr_change ON molam_attributes;
CREATE TRIGGER trigger_invalidate_cache_on_attr_change
  AFTER INSERT OR UPDATE OR DELETE ON molam_attributes
  FOR EACH ROW EXECUTE FUNCTION invalidate_authz_cache();

-- ============================================================================
-- Function: cleanup_expired_cache
-- Purpose: Periodic cleanup of expired cache entries
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_authz_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM molam_authz_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: get_effective_roles
-- Purpose: Get all effective roles for a user (including inherited)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_effective_roles(p_user_id UUID, p_module TEXT)
RETURNS TABLE(access_scope TEXT, trusted_level INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE role_tree AS (
    -- Base: direct roles
    SELECT r.access_scope, r.trusted_level
    FROM molam_roles r
    WHERE r.user_id = p_user_id
      AND r.module = p_module
      AND (r.expires_at IS NULL OR r.expires_at > now())

    UNION

    -- Recursive: inherited roles
    SELECT h.child_scope AS access_scope, rt.trusted_level
    FROM role_tree rt
    JOIN molam_role_hierarchy h ON h.parent_scope = rt.access_scope AND h.module = p_module
  )
  SELECT DISTINCT rt.access_scope, MAX(rt.trusted_level) as trusted_level
  FROM role_tree rt
  GROUP BY rt.access_scope;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE molam_roles IS 'User roles with module-level RBAC';
COMMENT ON TABLE molam_attributes IS 'Dynamic user attributes for ABAC';
COMMENT ON TABLE molam_authz_audit IS 'Immutable audit log of authorization decisions';
COMMENT ON TABLE molam_authz_cache IS 'Cache for authorization decisions (performance optimization)';
COMMENT ON TABLE molam_policies IS 'OPA-style policies with versioning';
COMMENT ON TABLE molam_role_hierarchy IS 'Role inheritance definitions';

-- ============================================================================
-- Sample data for testing
-- ============================================================================
-- Sample policy: Pay transfer requires KYC P2 and SIRA score >= 70
INSERT INTO molam_policies (name, version, module, description, policy_content, priority) VALUES
(
  'pay_transfer_kyc_sira',
  'v1.0',
  'pay',
  'Requires KYC P2+ and SIRA score >= 70 for transfers',
  '{
    "rules": [
      {
        "condition": "kyc_level IN (''P2'', ''P3'')",
        "sira_threshold": 70,
        "action": "transfer",
        "effect": "allow"
      }
    ]
  }'::JSONB,
  100
)
ON CONFLICT (name) DO NOTHING;

-- Sample policy: Business hours restriction
INSERT INTO molam_policies (name, version, module, description, policy_content, priority) VALUES
(
  'business_hours_restriction',
  'v1.0',
  'pay',
  'Restrict high-value transfers outside business hours (6-20)',
  '{
    "rules": [
      {
        "condition": "EXTRACT(HOUR FROM NOW()) BETWEEN 6 AND 20",
        "action": "transfer_high_value",
        "effect": "allow"
      }
    ]
  }'::JSONB,
  90
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- End of Brique 9 Schema
-- ============================================================================
