-- =====================================================================
-- Molam ID — Brique 21: API Role Management (add/remove)
-- Migration: 021_role_mgmt.sql
-- Description: Adds trusted_level hierarchy, approval workflows, and
--              idempotency support for secure role management
-- =====================================================================

-- 1) Extension (if necessary)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Add trusted_level column to roles (prevents privilege escalation)
--    Higher trusted_level = more privileged/trusted
--    Super admins typically have trusted_level >= 90
--    Regular admins: 60-80
--    External users (clients, agents, merchants, banks): 10-50
ALTER TABLE IF EXISTS molam_roles_v2
  ADD COLUMN IF NOT EXISTS trusted_level SMALLINT DEFAULT 10 CHECK (trusted_level >= 0 AND trusted_level <= 100);

-- Update existing roles with appropriate trust levels
UPDATE molam_roles_v2 SET trusted_level = 100 WHERE name = 'super_admin' AND module_scope = 'global';
UPDATE molam_roles_v2 SET trusted_level = 80 WHERE name LIKE '%_admin' AND module_scope != 'global';
UPDATE molam_roles_v2 SET trusted_level = 70 WHERE name = 'auditor';
UPDATE molam_roles_v2 SET trusted_level = 50 WHERE name IN ('marketer', 'commercial', 'support');
UPDATE molam_roles_v2 SET trusted_level = 30 WHERE name IN ('agent', 'merchant', 'bank');
UPDATE molam_roles_v2 SET trusted_level = 10 WHERE name = 'client';

-- 3) Table for approval workflows (for sensitive role grants)
--    Certain high-trust roles require approval from a higher authority
CREATE TABLE IF NOT EXISTS molam_role_grants_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,                -- correlates a grant request
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES molam_roles_v2(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  approver_required BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT NULL,
  justification TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_grants_approvals_status ON molam_role_grants_approvals(status);
CREATE INDEX IF NOT EXISTS idx_role_grants_approvals_user ON molam_role_grants_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_role_grants_approvals_requester ON molam_role_grants_approvals(requested_by);

-- 4) Idempotency keys table (prevents duplicate operations)
--    Clients send Idempotency-Key header to ensure exactly-once semantics
CREATE TABLE IF NOT EXISTS molam_idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,                     -- hash of request body
  response_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON molam_idempotency_keys(expires_at);

-- Cleanup function for expired idempotency keys (called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM molam_idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

-- 5) Security guard functions (SECURITY DEFINER for privilege checks)

-- Function: can_manage_scope
-- Checks if actor can manage roles in the specified scope
-- Global scope requires super_admin role
-- Module scope requires corresponding module admin role
CREATE OR REPLACE FUNCTION can_manage_scope(actor_id UUID, scope TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cnt INT;
BEGIN
  -- Validate scope
  IF scope NOT IN ('global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id') THEN
    RETURN FALSE;
  END IF;

  IF scope = 'global' THEN
    -- Only super_admin with global scope can manage global roles
    SELECT COUNT(*) INTO cnt
    FROM molam_user_roles ur
    JOIN molam_roles_v2 r ON r.id = ur.role_id
    WHERE ur.user_id = actor_id
      AND r.name = 'super_admin'
      AND r.module_scope = 'global'
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
    RETURN cnt > 0;
  ELSE
    -- Module admin can manage roles in their module, OR super_admin can manage anything
    SELECT COUNT(*) INTO cnt
    FROM molam_user_roles ur
    JOIN molam_roles_v2 r ON r.id = ur.role_id
    WHERE ur.user_id = actor_id
      AND (
        (r.name = scope || '_admin' AND r.module_scope = scope)
        OR (r.name = 'super_admin' AND r.module_scope = 'global')
      )
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
    RETURN cnt > 0;
  END IF;
END $$;

-- Function: has_higher_trust
-- Checks if actor has higher trust level than the target role
-- This prevents privilege escalation
CREATE OR REPLACE FUNCTION has_higher_trust(actor_id UUID, target_role_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor_max_tl SMALLINT;
  target_tl SMALLINT;
BEGIN
  -- Get actor's maximum trust level from all their roles
  SELECT MAX(r.trusted_level) INTO actor_max_tl
  FROM molam_user_roles ur
  JOIN molam_roles_v2 r ON r.id = ur.role_id
  WHERE ur.user_id = actor_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

  -- Get target role's trust level
  SELECT trusted_level INTO target_tl
  FROM molam_roles_v2
  WHERE id = target_role_id;

  IF actor_max_tl IS NULL THEN
    RETURN FALSE; -- Actor has no roles, cannot grant anything
  END IF;

  IF target_tl IS NULL THEN
    RETURN FALSE; -- Target role not found
  END IF;

  -- Actor must have STRICTLY higher trust level than target
  RETURN actor_max_tl > target_tl;
END $$;

-- Function: check_self_elevation
-- Prevents users from granting themselves higher privileges
CREATE OR REPLACE FUNCTION check_self_elevation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Block if user is granting role to themselves (unless granted by different user)
  IF NEW.user_id = NEW.granted_by THEN
    RAISE EXCEPTION 'self_elevation_forbidden: Users cannot grant roles to themselves';
  END IF;
  RETURN NEW;
END $$;

-- Trigger to prevent self-elevation
DROP TRIGGER IF EXISTS trg_prevent_self_elevation ON molam_user_roles;
CREATE TRIGGER trg_prevent_self_elevation
  BEFORE INSERT ON molam_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION check_self_elevation();

-- 6) Audit view for role assignments
CREATE OR REPLACE VIEW v_user_roles AS
SELECT
  u.id AS user_id,
  u.email,
  u.phone_e164,
  r.id AS role_id,
  r.name AS role_name,
  r.module_scope,
  r.trusted_level,
  r.role_type,
  ur.granted_by,
  granter.email AS granted_by_email,
  ur.expires_at,
  ur.scope_constraint,
  ur.justification,
  ur.created_at AS granted_at
FROM molam_user_roles ur
JOIN molam_users u ON u.id = ur.user_id
JOIN molam_roles_v2 r ON r.id = ur.role_id
LEFT JOIN molam_users granter ON granter.id = ur.granted_by;

-- 7) View for pending approval requests
CREATE OR REPLACE VIEW v_pending_role_approvals AS
SELECT
  a.id,
  a.request_id,
  a.user_id,
  u.email AS user_email,
  a.role_id,
  r.name AS role_name,
  r.module_scope,
  r.trusted_level,
  a.requested_by,
  req.email AS requested_by_email,
  a.status,
  a.justification,
  a.created_at,
  EXTRACT(EPOCH FROM (NOW() - a.created_at)) AS age_seconds
FROM molam_role_grants_approvals a
JOIN molam_users u ON u.id = a.user_id
JOIN molam_roles_v2 r ON r.id = a.role_id
JOIN molam_users req ON req.id = a.requested_by
WHERE a.status = 'pending';

-- 8) Function to get user's effective permissions with role metadata
CREATE OR REPLACE FUNCTION get_user_roles_with_metadata(p_user_id UUID)
RETURNS TABLE(
  role_id UUID,
  role_name TEXT,
  module_scope TEXT,
  trusted_level SMALLINT,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.module_scope,
    r.trusted_level,
    ur.created_at,
    ur.expires_at
  FROM molam_user_roles ur
  JOIN molam_roles_v2 r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.trusted_level DESC;
END $$;

-- 9) Indexing for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON molam_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON molam_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by ON molam_user_roles(granted_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON molam_user_roles(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roles_scope_trust ON molam_roles_v2(module_scope, trusted_level);
CREATE INDEX IF NOT EXISTS idx_roles_name ON molam_roles_v2(name);

-- 10) Comments for documentation
COMMENT ON TABLE molam_role_grants_approvals IS 'Approval workflow for sensitive role grants requiring higher authority review';
COMMENT ON TABLE molam_idempotency_keys IS 'Idempotency keys for exactly-once semantics in role management operations';
COMMENT ON COLUMN molam_roles_v2.trusted_level IS 'Trust level (0-100): higher values indicate more privileged roles. Prevents privilege escalation.';
COMMENT ON FUNCTION can_manage_scope(UUID, TEXT) IS 'Checks if actor has permission to manage roles in specified scope';
COMMENT ON FUNCTION has_higher_trust(UUID, UUID) IS 'Checks if actor has strictly higher trust level than target role';

-- =====================================================================
-- Migration complete: Brique 21 Role Management
-- =====================================================================
