-- =====================================================
-- Brique 32: API Role Management (extension of Brique 31)
-- =====================================================
-- Description:
--   Industrial-grade API for managing roles per subsidiary/module
--   Extends Brique 31 with delegation, search, and performance optimizations
--   Features:
--   - Role delegation with expiration
--   - Advanced search by role/module/user
--   - Materialized view for performance
--   - Enhanced audit trail
--   - Module isolation (Pay, Eats, Talk, Ads, Shop, Free, ID)
--
-- Dependencies:
--   - Brique 31 (RBAC granularité - molam_user_roles, molam_role_definitions, etc.)
-- =====================================================

-- =====================================================
-- 1. EXTEND USER ROLES WITH DELEGATION
-- =====================================================

-- Add delegation and lifecycle fields to molam_user_roles
ALTER TABLE molam_user_roles
  ADD COLUMN IF NOT EXISTS delegated_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN IF NOT EXISTS delegation_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES molam_users(user_id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_roles_timestamp ON molam_user_roles;
CREATE TRIGGER trg_update_user_roles_timestamp
  BEFORE UPDATE ON molam_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_roles_timestamp();

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_module ON molam_user_roles(user_id, module) WHERE is_active = true AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON molam_user_roles(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_roles_delegated ON molam_user_roles(delegated_by) WHERE delegated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_created_by ON molam_user_roles(created_by);

-- Hard guard: only one superadmin record per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_superadmin_per_user
  ON molam_user_roles(user_id)
  WHERE (module = 'id' AND role_key = 'superadmin' AND is_active = true AND revoked_at IS NULL);

COMMENT ON COLUMN molam_user_roles.delegated_by IS 'User who delegated this role (if delegation)';
COMMENT ON COLUMN molam_user_roles.delegation_reason IS 'Reason for delegation (mandatory for delegations)';
COMMENT ON COLUMN molam_user_roles.created_by IS 'User who created/assigned this role';
COMMENT ON COLUMN molam_user_roles.updated_by IS 'User who last updated this role';

-- =====================================================
-- 2. ENHANCED ROLE AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_role_management_audit (
  audit_id BIGSERIAL PRIMARY KEY,

  -- Who did what
  performed_by UUID NOT NULL REFERENCES molam_users(user_id),
  target_user UUID NOT NULL REFERENCES molam_users(user_id),

  -- Action details
  action VARCHAR(20) NOT NULL CHECK (action IN ('assign', 'revoke', 'update', 'delegate', 'expire')),
  module VARCHAR(20) NOT NULL,
  role_key VARCHAR(50) NOT NULL,

  -- State changes
  previous_state JSONB,
  new_state JSONB,

  -- Metadata
  reason TEXT,
  delegation_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  idempotency_key VARCHAR(255),

  -- Timing
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_delegation_reason CHECK (
    (action = 'delegate' AND delegation_reason IS NOT NULL) OR
    (action != 'delegate')
  )
);

CREATE INDEX idx_role_mgmt_audit_target ON molam_role_management_audit(target_user, performed_at DESC);
CREATE INDEX idx_role_mgmt_audit_performed_by ON molam_role_management_audit(performed_by, performed_at DESC);
CREATE INDEX idx_role_mgmt_audit_module ON molam_role_management_audit(module, performed_at DESC);
CREATE INDEX idx_role_mgmt_audit_action ON molam_role_management_audit(action, performed_at DESC);
CREATE INDEX idx_role_mgmt_audit_idempotency ON molam_role_management_audit(idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE molam_role_management_audit IS 'Enhanced audit trail for all role management operations';

-- =====================================================
-- 3. MATERIALIZED VIEW FOR EFFECTIVE ROLES
-- =====================================================

-- Drop existing view if any
DROP MATERIALIZED VIEW IF EXISTS mv_effective_user_roles CASCADE;

-- Create materialized view for currently effective roles (non-expired, non-revoked)
CREATE MATERIALIZED VIEW mv_effective_user_roles AS
SELECT
  r.user_role_id,
  r.user_id,
  r.role_key,
  r.module,
  r.access_scope,
  r.trusted_level,
  r.assigned_at,
  r.assigned_by,
  r.expires_at,
  r.delegated_by,
  r.delegation_reason,
  r.created_by,
  r.updated_by,
  r.approval_status,
  rd.role_name,
  rd.role_type,
  rd.description AS role_description
FROM molam_user_roles r
JOIN molam_role_definitions rd ON r.role_key = rd.role_key
WHERE
  r.is_active = true
  AND r.revoked_at IS NULL
  AND r.approval_status = 'approved'
  AND (r.expires_at IS NULL OR r.expires_at > NOW());

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_effective_user_roles_pk ON mv_effective_user_roles(user_role_id);
CREATE INDEX idx_mv_effective_user_roles_user ON mv_effective_user_roles(user_id);
CREATE INDEX idx_mv_effective_user_roles_user_module ON mv_effective_user_roles(user_id, module);
CREATE INDEX idx_mv_effective_user_roles_module_role ON mv_effective_user_roles(module, role_key);
CREATE INDEX idx_mv_effective_user_roles_delegated ON mv_effective_user_roles(delegated_by) WHERE delegated_by IS NOT NULL;

COMMENT ON MATERIALIZED VIEW mv_effective_user_roles IS 'Performance-optimized view of currently effective user roles';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_effective_roles_view()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_effective_user_roles;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. ROLE MANAGEMENT FUNCTIONS
-- =====================================================

-- Function: Assign role with delegation support
CREATE OR REPLACE FUNCTION assign_role_with_delegation(
  p_target_user UUID,
  p_role_key VARCHAR,
  p_module VARCHAR,
  p_access_scope VARCHAR DEFAULT 'read',
  p_trusted_level INTEGER DEFAULT 0,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_delegated_by UUID DEFAULT NULL,
  p_delegation_reason TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_role_id UUID;
  v_previous_state JSONB;
  v_new_state JSONB;
  v_action VARCHAR(20);
BEGIN
  -- Validate role exists
  IF NOT EXISTS (SELECT 1 FROM molam_role_definitions WHERE role_key = p_role_key AND is_active = true) THEN
    RAISE EXCEPTION 'Invalid role_key: %', p_role_key;
  END IF;

  -- Validate delegation requirements
  IF p_delegated_by IS NOT NULL AND p_delegation_reason IS NULL THEN
    RAISE EXCEPTION 'delegation_reason is required when delegated_by is specified';
  END IF;

  IF p_delegated_by IS NOT NULL AND p_expires_at IS NULL THEN
    RAISE EXCEPTION 'expires_at is required for delegated roles';
  END IF;

  -- Check if role already exists
  SELECT
    user_role_id,
    row_to_json(r.*)::JSONB
  INTO v_user_role_id, v_previous_state
  FROM molam_user_roles r
  WHERE user_id = p_target_user
    AND role_key = p_role_key
    AND module = p_module
    AND revoked_at IS NULL;

  IF v_user_role_id IS NOT NULL THEN
    -- Update existing role
    v_action := 'update';

    UPDATE molam_user_roles SET
      access_scope = p_access_scope,
      trusted_level = p_trusted_level,
      expires_at = p_expires_at,
      delegated_by = p_delegated_by,
      delegation_reason = p_delegation_reason,
      updated_by = p_assigned_by,
      updated_at = NOW()
    WHERE user_role_id = v_user_role_id
    RETURNING row_to_json(molam_user_roles.*)::JSONB INTO v_new_state;
  ELSE
    -- Insert new role
    v_action := CASE WHEN p_delegated_by IS NOT NULL THEN 'delegate' ELSE 'assign' END;

    INSERT INTO molam_user_roles (
      user_id,
      role_key,
      module,
      access_scope,
      trusted_level,
      assigned_by,
      assigned_at,
      expires_at,
      delegated_by,
      delegation_reason,
      created_by,
      updated_by,
      approval_status,
      is_active
    ) VALUES (
      p_target_user,
      p_role_key,
      p_module,
      p_access_scope,
      p_trusted_level,
      p_assigned_by,
      NOW(),
      p_expires_at,
      p_delegated_by,
      p_delegation_reason,
      p_assigned_by,
      p_assigned_by,
      'approved', -- Auto-approve for API assignments (vs. pending for sensitive roles)
      true
    )
    RETURNING user_role_id, row_to_json(molam_user_roles.*)::JSONB
    INTO v_user_role_id, v_new_state;
  END IF;

  RETURN v_user_role_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Revoke role
CREATE OR REPLACE FUNCTION revoke_role_by_module(
  p_target_user UUID,
  p_role_key VARCHAR,
  p_module VARCHAR,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_previous_state JSONB;
  v_affected_rows INTEGER;
BEGIN
  -- Get current state for audit
  SELECT row_to_json(r.*)::JSONB
  INTO v_previous_state
  FROM molam_user_roles r
  WHERE user_id = p_target_user
    AND role_key = p_role_key
    AND module = p_module
    AND revoked_at IS NULL;

  IF v_previous_state IS NULL THEN
    RETURN FALSE; -- Role doesn't exist or already revoked
  END IF;

  -- Revoke the role
  UPDATE molam_user_roles SET
    revoked_at = NOW(),
    revoked_by = p_revoked_by,
    revoked_reason = p_reason,
    is_active = false,
    updated_by = p_revoked_by,
    updated_at = NOW()
  WHERE user_id = p_target_user
    AND role_key = p_role_key
    AND module = p_module
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

  RETURN v_affected_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Search users by role/module
CREATE OR REPLACE FUNCTION search_users_by_role(
  p_module VARCHAR DEFAULT NULL,
  p_role_key VARCHAR DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  phone_e164 VARCHAR,
  full_name VARCHAR,
  module VARCHAR,
  role_key VARCHAR,
  role_name VARCHAR,
  access_scope VARCHAR,
  trusted_level INTEGER,
  expires_at TIMESTAMPTZ,
  delegated_by UUID,
  delegation_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.user_id,
    u.email,
    u.phone_e164,
    u.full_name,
    r.module,
    r.role_key,
    r.role_name,
    r.access_scope,
    r.trusted_level,
    r.expires_at,
    r.delegated_by,
    r.delegation_reason
  FROM mv_effective_user_roles r
  JOIN molam_users u ON u.user_id = r.user_id
  WHERE
    (p_module IS NULL OR r.module = p_module)
    AND (p_role_key IS NULL OR r.role_key = p_role_key)
    AND (
      p_search_query IS NULL
      OR u.email ILIKE '%' || p_search_query || '%'
      OR u.phone_e164 LIKE '%' || p_search_query || '%'
      OR u.full_name ILIKE '%' || p_search_query || '%'
    )
  ORDER BY r.module, r.role_key, u.email NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function: Get role statistics by module
CREATE OR REPLACE FUNCTION get_role_statistics_by_module(
  p_module VARCHAR DEFAULT NULL
) RETURNS TABLE (
  module VARCHAR,
  role_key VARCHAR,
  role_name VARCHAR,
  total_users BIGINT,
  delegated_count BIGINT,
  expiring_soon BIGINT -- expires in next 7 days
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.module,
    r.role_key,
    r.role_name,
    COUNT(DISTINCT r.user_id) AS total_users,
    COUNT(DISTINCT r.user_id) FILTER (WHERE r.delegated_by IS NOT NULL) AS delegated_count,
    COUNT(DISTINCT r.user_id) FILTER (WHERE r.expires_at IS NOT NULL AND r.expires_at <= NOW() + INTERVAL '7 days') AS expiring_soon
  FROM mv_effective_user_roles r
  WHERE p_module IS NULL OR r.module = p_module
  GROUP BY r.module, r.role_key, r.role_name
  ORDER BY r.module, r.role_key;
END;
$$ LANGUAGE plpgsql;

-- Function: Expire roles past their expiration date
CREATE OR REPLACE FUNCTION expire_roles()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE molam_user_roles SET
    is_active = false,
    revoked_at = NOW(),
    revoked_reason = 'Automatic expiration',
    updated_at = NOW()
  WHERE
    expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = true
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Refresh materialized view if any roles expired
  IF v_expired_count > 0 THEN
    PERFORM refresh_effective_roles_view();
  END IF;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VIEWS
-- =====================================================

-- View: Role assignments with user details
CREATE OR REPLACE VIEW v_user_role_assignments AS
SELECT
  r.user_role_id,
  r.user_id,
  u.email,
  u.phone_e164,
  u.full_name,
  r.role_key,
  rd.role_name,
  rd.role_type,
  r.module,
  r.access_scope,
  r.trusted_level,
  r.assigned_at,
  r.assigned_by,
  ab.email AS assigned_by_email,
  r.expires_at,
  r.delegated_by,
  db.email AS delegated_by_email,
  r.delegation_reason,
  r.approval_status,
  r.is_active,
  r.revoked_at,
  r.revoked_by,
  r.revoked_reason,
  CASE
    WHEN r.revoked_at IS NOT NULL THEN 'revoked'
    WHEN r.expires_at IS NOT NULL AND r.expires_at <= NOW() THEN 'expired'
    WHEN r.approval_status = 'pending' THEN 'pending'
    WHEN r.approval_status = 'rejected' THEN 'rejected'
    ELSE 'active'
  END AS status
FROM molam_user_roles r
JOIN molam_users u ON r.user_id = u.user_id
JOIN molam_role_definitions rd ON r.role_key = rd.role_key
LEFT JOIN molam_users ab ON r.assigned_by = ab.user_id
LEFT JOIN molam_users db ON r.delegated_by = db.user_id;

COMMENT ON VIEW v_user_role_assignments IS 'Complete view of user role assignments with user and role details';

-- View: Delegation summary
CREATE OR REPLACE VIEW v_delegation_summary AS
SELECT
  r.delegated_by,
  du.email AS delegator_email,
  du.full_name AS delegator_name,
  r.module,
  r.role_key,
  rd.role_name,
  COUNT(*) AS total_delegations,
  COUNT(*) FILTER (WHERE r.expires_at > NOW()) AS active_delegations,
  MIN(r.expires_at) AS earliest_expiration,
  MAX(r.expires_at) AS latest_expiration
FROM molam_user_roles r
JOIN molam_users du ON r.delegated_by = du.user_id
JOIN molam_role_definitions rd ON r.role_key = rd.role_key
WHERE
  r.delegated_by IS NOT NULL
  AND r.is_active = true
  AND r.revoked_at IS NULL
GROUP BY r.delegated_by, du.email, du.full_name, r.module, r.role_key, rd.role_name;

COMMENT ON VIEW v_delegation_summary IS 'Summary of role delegations by delegator';

-- =====================================================
-- 6. TRIGGERS FOR AUTO-REFRESH
-- =====================================================

-- Auto-refresh materialized view on role changes (async via NOTIFY)
CREATE OR REPLACE FUNCTION notify_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify application to refresh materialized view
  PERFORM pg_notify('role_change', json_build_object(
    'action', TG_OP,
    'user_id', COALESCE(NEW.user_id, OLD.user_id),
    'module', COALESCE(NEW.module, OLD.module),
    'role_key', COALESCE(NEW.role_key, OLD.role_key)
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_role_change ON molam_user_roles;
CREATE TRIGGER trg_notify_role_change
  AFTER INSERT OR UPDATE OR DELETE ON molam_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION notify_role_change();

-- =====================================================
-- 7. GRANTS & SECURITY
-- =====================================================

-- Grant permissions to application role
-- GRANT SELECT ON mv_effective_user_roles TO molam_app_role;
-- GRANT SELECT ON v_user_role_assignments TO molam_app_role;
-- GRANT SELECT ON v_delegation_summary TO molam_app_role;
-- GRANT EXECUTE ON FUNCTION assign_role_with_delegation TO molam_app_role;
-- GRANT EXECUTE ON FUNCTION revoke_role_by_module TO molam_app_role;
-- GRANT EXECUTE ON FUNCTION search_users_by_role TO molam_app_role;
-- GRANT EXECUTE ON FUNCTION get_role_statistics_by_module TO molam_app_role;

-- =====================================================
-- EXAMPLE QUERIES
-- =====================================================

-- Example 1: Assign admin role to user
-- SELECT assign_role_with_delegation(
--   'user-uuid',           -- target user
--   'admin',               -- role_key
--   'pay',                 -- module
--   'admin',               -- access_scope
--   4,                     -- trusted_level
--   NULL,                  -- expires_at (NULL = permanent)
--   'assigner-uuid',       -- assigned_by
--   NULL,                  -- delegated_by (NULL = not delegated)
--   NULL,                  -- delegation_reason
--   'Promotion to admin'   -- reason
-- );

-- Example 2: Delegate temporary role
-- SELECT assign_role_with_delegation(
--   'contractor-uuid',
--   'developer',
--   'global',
--   'write',
--   3,
--   NOW() + INTERVAL '30 days',  -- expires in 30 days
--   'admin-uuid',
--   'admin-uuid',                 -- delegated_by = assigned_by for delegation
--   'Q1 2025 contractor project',
--   'Temporary access for project'
-- );

-- Example 3: Search users by role
-- SELECT * FROM search_users_by_role(
--   'pay',      -- module
--   'agent',    -- role_key
--   'john',     -- search query
--   20,         -- limit
--   0           -- offset
-- );

-- Example 4: Get role statistics
-- SELECT * FROM get_role_statistics_by_module('pay');

-- Example 5: Revoke role
-- SELECT revoke_role_by_module(
--   'user-uuid',
--   'admin',
--   'pay',
--   'revoker-uuid',
--   'Contract ended'
-- );

-- Example 6: Expire old roles (run via cron)
-- SELECT expire_roles();

-- Example 7: Refresh materialized view
-- SELECT refresh_effective_roles_view();
