-- ============================================================================
-- MOLAM ID - RBAC GRANULAR SCHEMA
-- ============================================================================
-- Description: Advanced RBAC system for Molam ID
-- External actors: clients, agents, merchants, banks
-- Internal actors: super_admin, subsidiary_admin, auditor, support
-- ============================================================================

-- ============================================================================
-- 1. Permissions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  module VARCHAR(50) NOT NULL CHECK (module IN ('id', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'connect', 'go')),
  resource_type VARCHAR(100),
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'execute', 'approve', 'audit')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

COMMENT ON TABLE permissions IS 'System permissions (module.resource.action)';
COMMENT ON COLUMN permissions.code IS 'Permission code (e.g., pay.transfer.create, id.users.read)';

-- ============================================================================
-- 2. Roles Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('external', 'internal')),
  module_scope VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_type ON roles(role_type);
CREATE INDEX IF NOT EXISTS idx_roles_scope ON roles(module_scope);

COMMENT ON TABLE roles IS 'System roles with granular scopes';
COMMENT ON COLUMN roles.role_type IS 'Type: external (users) or internal (employees)';
COMMENT ON COLUMN roles.module_scope IS 'Scope: global, pay, eats, talk, ads, shop, etc.';
COMMENT ON COLUMN roles.priority IS 'Priority for conflict resolution (higher = more privileged)';

-- ============================================================================
-- 3. Role-Permission Assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  perm_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (role_id, perm_id)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON role_permissions(perm_id);

-- ============================================================================
-- 4. User-Role Assignments
-- ============================================================================

-- Add role column to users if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'client';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  scope_constraint TEXT,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  justification TEXT,
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at);

-- ============================================================================
-- 5. RBAC Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  permission_code VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  result VARCHAR(20) NOT NULL CHECK (result IN ('granted', 'denied')),
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_user ON rbac_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_action ON rbac_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_result ON rbac_audit_log(result);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_log(created_at);

COMMENT ON TABLE rbac_audit_log IS 'Immutable audit log for all RBAC decisions';

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert basic permissions
INSERT INTO permissions (code, description, module, resource_type, action) VALUES
-- ID Module
('id.profile.read', 'Read own profile', 'id', 'profile', 'read'),
('id.profile.update', 'Update own profile', 'id', 'profile', 'update'),
('id.users.read', 'Read all users', 'id', 'users', 'read'),
('id.users.create', 'Create users', 'id', 'users', 'create'),
('id.users.update', 'Update users', 'id', 'users', 'update'),
('id.users.delete', 'Delete users', 'id', 'users', 'delete'),
('id.audit.read', 'Read audit logs', 'id', 'audit', 'read'),

-- Pay Module
('pay.transfer.create', 'Create transfers', 'pay', 'transfer', 'create'),
('pay.transfer.read', 'Read transfers', 'pay', 'transfer', 'read'),
('pay.balance.read', 'Read balance', 'pay', 'balance', 'read'),
('pay.cashin.create', 'Cash-in operations', 'pay', 'cashin', 'create'),
('pay.cashout.create', 'Cash-out operations', 'pay', 'cashout', 'create'),
('pay.reports.read', 'Read financial reports', 'pay', 'reports', 'read'),

-- Admin wildcard permissions
('*.read', 'Read all resources', 'id', 'all', 'read'),
('*.audit', 'Audit all resources', 'id', 'all', 'audit'),
('*', 'All permissions (super admin)', 'id', 'all', 'execute')
ON CONFLICT (code) DO NOTHING;

-- Insert basic roles
INSERT INTO roles (name, display_name, description, role_type, module_scope, priority, is_system) VALUES
-- External roles
('client', 'Client', 'Regular user/client', 'external', 'global', 10, true),
('agent', 'Agent', 'Cash-in/out agent', 'external', 'pay', 20, true),
('merchant', 'Merchant', 'Merchant/business', 'external', 'pay', 20, true),

-- Internal roles
('support', 'Support', 'Customer support', 'internal', 'global', 40, true),
('auditor', 'Auditor', 'System auditor (read-only)', 'internal', 'global', 70, true),
('admin', 'Administrator', 'System administrator', 'internal', 'global', 80, true),
('super_admin', 'Super Admin', 'Super administrator (all permissions)', 'internal', 'global', 100, true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles

-- CLIENT: basic profile + pay operations
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'client' AND p.code IN (
  'id.profile.read',
  'id.profile.update',
  'pay.transfer.create',
  'pay.transfer.read',
  'pay.balance.read'
)
ON CONFLICT DO NOTHING;

-- AGENT: cash operations
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'agent' AND p.code IN (
  'id.profile.read',
  'id.profile.update',
  'pay.cashin.create',
  'pay.cashout.create',
  'pay.transfer.read',
  'pay.balance.read'
)
ON CONFLICT DO NOTHING;

-- SUPPORT: read access to users and transactions
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'support' AND p.code IN (
  'id.users.read',
  'pay.transfer.read',
  'pay.reports.read'
)
ON CONFLICT DO NOTHING;

-- AUDITOR: read-only + audit
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'auditor' AND p.code IN (
  '*.read',
  '*.audit'
)
ON CONFLICT DO NOTHING;

-- ADMIN: most permissions except super admin wildcard
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code LIKE 'id.%'
ON CONFLICT DO NOTHING;

-- SUPER_ADMIN: wildcard permission
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin' AND p.code = '*'
ON CONFLICT DO NOTHING;

-- Assign default role to existing users
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE r.name = 'client'
AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(p_user_id INTEGER, p_permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_perm BOOLEAN;
BEGIN
  -- Check if user has the exact permission or wildcard
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.perm_id = p.id
    WHERE ur.user_id = p_user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (
        p.code = p_permission_code  -- Exact match
        OR p.code = '*'  -- Super admin wildcard
        OR (p.code = '*.read' AND p_permission_code LIKE '%.read')  -- Read wildcard
        OR (p.code = '*.audit' AND p_permission_code LIKE '%.audit')  -- Audit wildcard
      )
  ) INTO v_has_perm;

  RETURN v_has_perm;
END;
$$ LANGUAGE plpgsql;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id INTEGER)
RETURNS TABLE (permission_code TEXT, permission_description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.code, p.description
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.perm_id = p.id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY p.code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RBAC Granular schema created successfully!';
  RAISE NOTICE '📋 Permissions: % ', (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE '👥 Roles: %', (SELECT COUNT(*) FROM roles);
  RAISE NOTICE '🔗 Role-Permission mappings: %', (SELECT COUNT(*) FROM role_permissions);
END $$;
