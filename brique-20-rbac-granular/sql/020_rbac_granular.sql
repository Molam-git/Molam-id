-- ============================================================================
-- Brique 20: RBAC Granular (Fine-Grained Access Control)
-- ============================================================================
-- Description: Advanced RBAC system for all Molam actors
-- External: clients, agents, merchants, banks
-- Internal: super_admin, subsidiary_admin, auditor, marketer, commercial, support
-- ============================================================================

-- ============================================================================
-- Permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('id', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'connect', 'go')),
  resource_type TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'execute', 'approve', 'audit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE molam_permissions IS 'System permissions (module.resource.action)';
COMMENT ON COLUMN molam_permissions.code IS 'Permission code (e.g., pay.transfer.create)';
COMMENT ON COLUMN molam_permissions.module IS 'Module: id, pay, eats, talk, ads, shop, free, connect, go';
COMMENT ON COLUMN molam_permissions.resource_type IS 'Resource type (e.g., transfer, post, ad, order)';
COMMENT ON COLUMN molam_permissions.action IS 'Action: create, read, update, delete, execute, approve, audit';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permissions_code ON molam_permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON molam_permissions(module);

-- ============================================================================
-- Roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_roles_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('external', 'internal')),
  module_scope TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE molam_roles_v2 IS 'System roles (v2 with granular scopes)';
COMMENT ON COLUMN molam_roles_v2.name IS 'Role name (e.g., client, agent, merchant, super_admin)';
COMMENT ON COLUMN molam_roles_v2.role_type IS 'Type: external (users) or internal (employees)';
COMMENT ON COLUMN molam_roles_v2.module_scope IS 'Scope: global, pay, eats, talk, ads, shop, free, connect, go';
COMMENT ON COLUMN molam_roles_v2.priority IS 'Priority for conflict resolution (higher = more privileged)';
COMMENT ON COLUMN molam_roles_v2.is_system IS 'System role (cannot be deleted)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON molam_roles_v2(name);
CREATE INDEX IF NOT EXISTS idx_roles_type ON molam_roles_v2(role_type);
CREATE INDEX IF NOT EXISTS idx_roles_scope ON molam_roles_v2(module_scope);

-- ============================================================================
-- Role-Permission Assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_role_permissions (
  role_id UUID REFERENCES molam_roles_v2(id) ON DELETE CASCADE,
  perm_id UUID REFERENCES molam_permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES molam_users(id) ON DELETE SET NULL,
  PRIMARY KEY (role_id, perm_id)
);

-- Comments
COMMENT ON TABLE molam_role_permissions IS 'Role to permission mapping';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_perms_role ON molam_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON molam_role_permissions(perm_id);

-- ============================================================================
-- User-Role Assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_user_roles (
  user_id UUID REFERENCES molam_users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES molam_roles_v2(id) ON DELETE CASCADE,
  scope_constraint TEXT,
  granted_by UUID REFERENCES molam_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  justification TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, role_id)
);

-- Comments
COMMENT ON TABLE molam_user_roles IS 'User to role assignments';
COMMENT ON COLUMN molam_user_roles.scope_constraint IS 'Optional scope constraint (e.g., subsidiary:PAY)';
COMMENT ON COLUMN molam_user_roles.expires_at IS 'Expiration date for temporary role assignments';
COMMENT ON COLUMN molam_user_roles.justification IS 'Reason for role assignment (required for auditors)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON molam_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON molam_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by ON molam_user_roles(granted_by);

-- ============================================================================
-- RBAC Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_rbac_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES molam_users(id) ON DELETE SET NULL,
  role_id UUID,
  perm_code TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE molam_rbac_audit IS 'Immutable audit log for RBAC decisions';
COMMENT ON COLUMN molam_rbac_audit.decision IS 'Decision: allow or deny';
COMMENT ON COLUMN molam_rbac_audit.context IS 'Request context (path, method, resource_id, etc.)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rbac_audit_user ON molam_rbac_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_perm ON molam_rbac_audit(perm_code);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_decision ON molam_rbac_audit(decision);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON molam_rbac_audit(created_at DESC);

-- ============================================================================
-- Policy Versions (GitOps)
-- ============================================================================

CREATE TABLE IF NOT EXISTS molam_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  policy_yaml TEXT NOT NULL,
  signature TEXT NOT NULL,
  published_by UUID REFERENCES molam_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Comments
COMMENT ON TABLE molam_policy_versions IS 'Versioned RBAC policies (GitOps)';
COMMENT ON COLUMN molam_policy_versions.policy_yaml IS 'YAML policy content';
COMMENT ON COLUMN molam_policy_versions.signature IS 'Ed25519 signature for integrity';
COMMENT ON COLUMN molam_policy_versions.is_active IS 'Currently active policy version';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policy_versions_active ON molam_policy_versions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_policy_versions_published ON molam_policy_versions(published_at DESC);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Check if user has permission
CREATE OR REPLACE FUNCTION has_permission(p_user_id UUID, p_perm_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM molam_user_roles ur
  JOIN molam_role_permissions rp ON ur.role_id = rp.role_id
  JOIN molam_permissions p ON rp.perm_id = p.id
  WHERE ur.user_id = p_user_id
    AND p.code = p_perm_code
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION has_permission(UUID, TEXT) IS 'Check if user has a specific permission';

-- Function: Get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  permission_code TEXT,
  role_name TEXT,
  module TEXT,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.code as permission_code,
    r.name as role_name,
    p.module,
    p.action
  FROM molam_user_roles ur
  JOIN molam_roles_v2 r ON ur.role_id = r.id
  JOIN molam_role_permissions rp ON r.id = rp.role_id
  JOIN molam_permissions p ON rp.perm_id = p.id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY p.module, p.code;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Get all permissions for a user';

-- Function: Get user roles
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  role_type TEXT,
  module_scope TEXT,
  scope_constraint TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as role_id,
    r.name as role_name,
    r.role_type,
    r.module_scope,
    ur.scope_constraint,
    ur.expires_at
  FROM molam_user_roles ur
  JOIN molam_roles_v2 r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.priority DESC, r.name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_roles(UUID) IS 'Get all active roles for a user';

-- Function: Grant role to user
CREATE OR REPLACE FUNCTION grant_role(
  p_user_id UUID,
  p_role_name TEXT,
  p_granted_by UUID,
  p_scope_constraint TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_justification TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Get role ID
  SELECT id INTO v_role_id FROM molam_roles_v2 WHERE name = p_role_name;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', p_role_name;
  END IF;

  -- Insert or update
  INSERT INTO molam_user_roles (
    user_id, role_id, scope_constraint, granted_by, expires_at, justification
  ) VALUES (
    p_user_id, v_role_id, p_scope_constraint, p_granted_by, p_expires_at, p_justification
  )
  ON CONFLICT (user_id, role_id) DO UPDATE
  SET
    scope_constraint = EXCLUDED.scope_constraint,
    granted_by = EXCLUDED.granted_by,
    granted_at = NOW(),
    expires_at = EXCLUDED.expires_at,
    justification = EXCLUDED.justification;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION grant_role IS 'Grant a role to a user';

-- Function: Revoke role from user
CREATE OR REPLACE FUNCTION revoke_role(
  p_user_id UUID,
  p_role_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role_id UUID;
  v_deleted INTEGER;
BEGIN
  -- Get role ID
  SELECT id INTO v_role_id FROM molam_roles_v2 WHERE name = p_role_name;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', p_role_name;
  END IF;

  -- Delete assignment
  DELETE FROM molam_user_roles
  WHERE user_id = p_user_id AND role_id = v_role_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION revoke_role IS 'Revoke a role from a user';

-- Function: Get RBAC statistics
CREATE OR REPLACE FUNCTION get_rbac_stats()
RETURNS TABLE (
  total_permissions BIGINT,
  total_roles BIGINT,
  total_user_roles BIGINT,
  total_audit_entries BIGINT,
  allow_count BIGINT,
  deny_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM molam_permissions) as total_permissions,
    (SELECT COUNT(*) FROM molam_roles_v2) as total_roles,
    (SELECT COUNT(*) FROM molam_user_roles) as total_user_roles,
    (SELECT COUNT(*) FROM molam_rbac_audit) as total_audit_entries,
    (SELECT COUNT(*) FROM molam_rbac_audit WHERE decision = 'allow') as allow_count,
    (SELECT COUNT(*) FROM molam_rbac_audit WHERE decision = 'deny') as deny_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_rbac_stats() IS 'Get RBAC system statistics';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at for permissions
CREATE OR REPLACE FUNCTION update_permission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permissions_updated
  BEFORE UPDATE ON molam_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_permission_timestamp();

-- Auto-update updated_at for roles
CREATE TRIGGER trg_roles_updated
  BEFORE UPDATE ON molam_roles_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_permission_timestamp();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON molam_permissions TO molam_app;
GRANT SELECT, INSERT, UPDATE ON molam_roles_v2 TO molam_app;
GRANT SELECT, INSERT, DELETE ON molam_role_permissions TO molam_app;
GRANT SELECT, INSERT, DELETE ON molam_user_roles TO molam_app;
GRANT SELECT, INSERT ON molam_rbac_audit TO molam_app;
GRANT SELECT, INSERT ON molam_policy_versions TO molam_app;

GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT) TO molam_app;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO molam_app;
GRANT EXECUTE ON FUNCTION get_user_roles(UUID) TO molam_app;
GRANT EXECUTE ON FUNCTION grant_role TO molam_app;
GRANT EXECUTE ON FUNCTION revoke_role TO molam_app;
GRANT EXECUTE ON FUNCTION get_rbac_stats() TO molam_app;
