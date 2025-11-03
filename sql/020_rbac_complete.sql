-- Sprint 2: RBAC & Permissions Complete Schema
-- Briques 20, 21, 22, 23: Permission Management, Role Management, Policy Engine, Audit Trail

-- ============================================================================
-- Brique 20: Permissions (Permission Management)
-- ============================================================================

-- Table des permissions disponibles
CREATE TABLE IF NOT EXISTS molam_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) UNIQUE NOT NULL, -- Format: module:resource:action (ex: pay:transfer:create)
    module VARCHAR(50) NOT NULL, -- Module auquel appartient la permission (id, pay, chat, etc.)
    resource VARCHAR(50) NOT NULL, -- Ressource concernée (user, transfer, message, etc.)
    action VARCHAR(20) NOT NULL, -- Action autorisée (create, read, update, delete, execute)
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON molam_permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON molam_permissions(permission_name);

-- ============================================================================
-- Brique 21: Roles (Role Management)
-- ============================================================================

-- Table des rôles disponibles
CREATE TABLE IF NOT EXISTS molam_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) UNIQUE NOT NULL, -- Nom unique du rôle (ex: id_admin, pay_user, chat_moderator)
    module VARCHAR(50) NOT NULL, -- Module principal du rôle
    display_name VARCHAR(100), -- Nom d'affichage
    description TEXT,
    inherits_from VARCHAR(100), -- Héritage de rôle (optionnel)
    is_system_role BOOLEAN DEFAULT FALSE, -- Rôle système non modifiable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (inherits_from) REFERENCES molam_roles(role_name) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_module ON molam_roles(module);
CREATE INDEX IF NOT EXISTS idx_roles_name ON molam_roles(role_name);

-- Table d'association roles-permissions
CREATE TABLE IF NOT EXISTS molam_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES molam_users(id),
    UNIQUE(role_name, permission_name),
    FOREIGN KEY (role_name) REFERENCES molam_roles(role_name) ON DELETE CASCADE,
    FOREIGN KEY (permission_name) REFERENCES molam_permissions(permission_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON molam_role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON molam_role_permissions(permission_name);

-- Table d'attribution de rôles aux utilisateurs
CREATE TABLE IF NOT EXISTS molam_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    trusted_level INTEGER DEFAULT 10, -- Niveau de confiance (0-100)
    granted_by UUID REFERENCES molam_users(id), -- Qui a attribué le rôle
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Expiration optionnelle
    UNIQUE(user_id, role_name, module),
    FOREIGN KEY (role_name) REFERENCES molam_roles(role_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON molam_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON molam_user_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_module ON molam_user_roles(module);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON molam_user_roles(expires_at);

-- ============================================================================
-- Brique 22: Policy Engine (ABAC Policies)
-- ============================================================================

-- Table des policies (règles d'autorisation avancées)
CREATE TABLE IF NOT EXISTS molam_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL, -- Module concerné (ou '*' pour tous)
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')), -- Autoriser ou refuser
    priority INTEGER DEFAULT 100, -- Priorité (plus bas = plus prioritaire)

    -- Ressources et actions concernées
    resources TEXT[], -- Patterns de ressources (ex: ['/api/pay/transfer/*'])
    actions TEXT[], -- Actions HTTP (ex: ['GET', 'POST'])

    -- Condition ABAC (JSONB pour flexibilité)
    condition JSONB, -- Ex: {"roles": ["pay_admin"], "time_of_day": {"gte": 8, "lte": 18}}

    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_module ON molam_policies(module);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON molam_policies(enabled);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON molam_policies(priority);

-- ============================================================================
-- Brique 23: Audit Trail (Authorization Decisions Log)
-- ============================================================================

-- Table des décisions d'autorisation (audit complet)
CREATE TABLE IF NOT EXISTS molam_authz_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) UNIQUE NOT NULL, -- ID de tracking unique
    user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,

    -- Décision
    decision VARCHAR(10) NOT NULL CHECK (decision IN ('allow', 'deny')),
    reason TEXT,

    -- Contexte de la requête
    path VARCHAR(255),
    method VARCHAR(10),
    module VARCHAR(50),

    -- Contexte d'évaluation
    roles TEXT[], -- Rôles de l'utilisateur au moment de la décision
    policies_applied UUID[], -- IDs des policies appliquées
    context JSONB, -- Contexte ABAC complet

    -- Metadata
    ttl INTEGER, -- TTL du cache (secondes)
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    decided_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_decisions_user ON molam_authz_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_audit ON molam_authz_decisions(audit_id);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_decision ON molam_authz_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_module ON molam_authz_decisions(module);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_created ON molam_authz_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_authz_decisions_expires ON molam_authz_decisions(expires_at);

-- Table de cache des décisions (performance)
CREATE TABLE IF NOT EXISTS molam_authz_cache (
    cache_key VARCHAR(64) PRIMARY KEY, -- Hash SHA256 de la requête
    decision VARCHAR(10) NOT NULL,
    audit_id VARCHAR(50) NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authz_cache_expires ON molam_authz_cache(expires_at);

-- ============================================================================
-- Fonctions PostgreSQL
-- ============================================================================

-- Fonction pour obtenir les rôles avec héritage
CREATE OR REPLACE FUNCTION get_user_roles_with_inheritance(p_user_id UUID)
RETURNS TABLE (
    role_name VARCHAR(100),
    module VARCHAR(50),
    trusted_level INTEGER,
    inherits_from VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE role_hierarchy AS (
        -- Rôles directs de l'utilisateur
        SELECT
            ur.role_name,
            ur.module,
            ur.trusted_level,
            r.inherits_from
        FROM molam_user_roles ur
        JOIN molam_roles r ON ur.role_name = r.role_name
        WHERE ur.user_id = p_user_id
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())

        UNION

        -- Rôles hérités récursivement
        SELECT
            r.inherits_from as role_name,
            r.module,
            rh.trusted_level,
            r2.inherits_from
        FROM role_hierarchy rh
        JOIN molam_roles r ON rh.inherits_from = r.role_name
        LEFT JOIN molam_roles r2 ON r.inherits_from = r2.role_name
        WHERE r.inherits_from IS NOT NULL
    )
    SELECT DISTINCT
        rh.role_name,
        rh.module,
        rh.trusted_level,
        rh.inherits_from
    FROM role_hierarchy rh;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer le cache expiré
CREATE OR REPLACE FUNCTION cleanup_authz_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Supprimer les entrées expirées du cache
    DELETE FROM molam_authz_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Supprimer les décisions expirées (garder pour audit pendant 90 jours)
    DELETE FROM molam_authz_decisions
    WHERE created_at < NOW() - INTERVAL '90 days';

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Données de seed initiales
-- ============================================================================

-- Insérer les permissions de base pour le module ID
INSERT INTO molam_permissions (permission_name, module, resource, action, description) VALUES
    ('id:user:read', 'id', 'user', 'read', 'Lire les informations utilisateur'),
    ('id:user:write', 'id', 'user', 'write', 'Modifier les informations utilisateur'),
    ('id:user:delete', 'id', 'user', 'delete', 'Supprimer un utilisateur'),
    ('id:user:create', 'id', 'user', 'create', 'Créer un utilisateur'),
    ('id:session:read', 'id', 'session', 'read', 'Lire les sessions'),
    ('id:session:revoke', 'id', 'session', 'delete', 'Révoquer des sessions'),
    ('id:role:assign', 'id', 'role', 'write', 'Attribuer des rôles'),
    ('id:role:revoke', 'id', 'role', 'delete', 'Révoquer des rôles'),
    ('id:blacklist:manage', 'id', 'blacklist', 'write', 'Gérer la blacklist')
ON CONFLICT (permission_name) DO NOTHING;

-- Insérer les rôles de base
INSERT INTO molam_roles (role_name, module, display_name, description, is_system_role) VALUES
    ('id_user', 'id', 'Utilisateur', 'Utilisateur standard de Molam ID', true),
    ('id_moderator', 'id', 'Modérateur', 'Modérateur avec accès aux sessions', true),
    ('id_admin', 'id', 'Administrateur ID', 'Administrateur complet de Molam ID', true),
    ('superadmin', '*', 'Super Admin', 'Administrateur global avec tous les droits', true)
ON CONFLICT (role_name) DO NOTHING;

-- Associer les permissions aux rôles
INSERT INTO molam_role_permissions (role_name, permission_name) VALUES
    -- id_user: lecture de ses propres données
    ('id_user', 'id:user:read'),
    ('id_user', 'id:user:write'),
    ('id_user', 'id:session:read'),
    ('id_user', 'id:session:revoke'),

    -- id_moderator: gestion des sessions
    ('id_moderator', 'id:user:read'),
    ('id_moderator', 'id:session:read'),
    ('id_moderator', 'id:session:revoke'),

    -- id_admin: toutes les permissions ID
    ('id_admin', 'id:user:read'),
    ('id_admin', 'id:user:write'),
    ('id_admin', 'id:user:delete'),
    ('id_admin', 'id:user:create'),
    ('id_admin', 'id:session:read'),
    ('id_admin', 'id:session:revoke'),
    ('id_admin', 'id:role:assign'),
    ('id_admin', 'id:role:revoke'),
    ('id_admin', 'id:blacklist:manage')
ON CONFLICT (role_name, permission_name) DO NOTHING;

-- Insérer des policies de base
INSERT INTO molam_policies (name, description, module, effect, priority, resources, actions, condition, enabled) VALUES
    (
        'deny_blacklisted_users',
        'Refuser l''accès aux utilisateurs blacklistés',
        '*',
        'deny',
        1,
        ARRAY['/**'],
        ARRAY['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        '{"is_blacklisted": true}'::jsonb,
        true
    ),
    (
        'allow_admin_all',
        'Autoriser tous les accès pour les admins',
        '*',
        'allow',
        10,
        ARRAY['/**'],
        ARRAY['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        '{"roles": ["id_admin", "superadmin"]}'::jsonb,
        true
    ),
    (
        'rate_limit_api',
        'Limiter le nombre de requêtes API',
        '*',
        'deny',
        50,
        ARRAY['/api/**'],
        ARRAY['POST', 'PUT', 'DELETE'],
        '{"rate_limit_exceeded": true}'::jsonb,
        true
    )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Commentaires
-- ============================================================================

COMMENT ON TABLE molam_permissions IS 'Permissions disponibles dans le système';
COMMENT ON TABLE molam_roles IS 'Rôles disponibles avec héritage';
COMMENT ON TABLE molam_role_permissions IS 'Association rôles-permissions';
COMMENT ON TABLE molam_user_roles IS 'Attribution de rôles aux utilisateurs';
COMMENT ON TABLE molam_policies IS 'Policies ABAC pour autorisation avancée';
COMMENT ON TABLE molam_authz_decisions IS 'Audit trail des décisions d''autorisation';
COMMENT ON TABLE molam_authz_cache IS 'Cache des décisions pour performance';

COMMENT ON COLUMN molam_user_roles.trusted_level IS 'Niveau de confiance 0-100';
COMMENT ON COLUMN molam_policies.effect IS 'allow ou deny - deny l''emporte toujours';
COMMENT ON COLUMN molam_policies.condition IS 'Condition ABAC en JSONB (ex: {"roles": ["admin"], "time": {"gte": 8}})';
COMMENT ON COLUMN molam_authz_decisions.ttl IS 'Durée de vie du cache en secondes';
