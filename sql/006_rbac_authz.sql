-- ========================================
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
