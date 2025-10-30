-- =====================================================
-- Brique 31: RBAC granularité (client, agent, marchand, admin, auditeur, banque)
-- =====================================================
-- Description:
--   Granular role-based access control for multi-subsidiary Molam platform
--   - External users: client, agent, merchant
--   - Internal users: superadmin, subsidiary admin, auditor, marketer, support
--   - Partner institutions: banks, regulators
--   - Module-scoped roles with strict separation
--   - Fine-grained permissions per action
--   - Trust levels (0-5)
--   - Temporal roles with expiration
--
-- Dependencies:
--   - brique-21-sira (molam_users, molam_subsidiaries)
-- =====================================================

-- =====================================================
-- 1. ROLE DEFINITIONS (Global Registry)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_role_definitions (
  role_id           SERIAL PRIMARY KEY,
  role_key          VARCHAR(50) NOT NULL UNIQUE,
  role_name         VARCHAR(100) NOT NULL,
  role_type         VARCHAR(20) NOT NULL CHECK (role_type IN ('external', 'internal', 'partner', 'system')),
  description       TEXT,

  -- Trust configuration
  min_trust_level   INTEGER DEFAULT 0 CHECK (min_trust_level >= 0 AND min_trust_level <= 5),
  max_trust_level   INTEGER DEFAULT 5 CHECK (max_trust_level >= 0 AND max_trust_level <= 5),

  -- Behavior
  is_assignable     BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,

  -- Metadata
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_trust_levels CHECK (max_trust_level >= min_trust_level)
);

CREATE INDEX idx_role_defs_key ON molam_role_definitions(role_key);
CREATE INDEX idx_role_defs_type ON molam_role_definitions(role_type);

COMMENT ON TABLE molam_role_definitions IS 'Global registry of available roles';

-- Preload standard roles
INSERT INTO molam_role_definitions (role_key, role_name, role_type, description, min_trust_level, max_trust_level) VALUES
  -- External roles
  ('client', 'Client', 'external', 'Regular customer/end-user', 0, 2),
  ('agent', 'Agent Partenaire', 'external', 'Physical agent for cash-in/cash-out', 1, 3),
  ('merchant', 'Marchand/Professionnel', 'external', 'Business merchant accepting payments', 1, 3),

  -- Internal roles
  ('superadmin', 'Super Administrateur', 'internal', 'Global platform administrator', 5, 5),
  ('admin', 'Administrateur de Filiale', 'internal', 'Subsidiary administrator', 3, 4),
  ('auditor', 'Auditeur', 'internal', 'Compliance and audit officer (read-only)', 2, 3),
  ('support', 'Support Client', 'internal', 'Customer support agent', 1, 2),
  ('marketer', 'Marketeur', 'internal', 'Marketing team member', 1, 2),
  ('developer', 'Développeur', 'internal', 'Technical team member', 2, 4),

  -- Partner roles
  ('bank', 'Banque Partenaire', 'partner', 'Partner bank for regulatory/compliance', 2, 3),
  ('regulator', 'Régulateur', 'partner', 'Regulatory authority (BCEAO, etc.)', 3, 4),
  ('auditor_external', 'Auditeur Externe', 'partner', 'External audit firm', 2, 3);

-- =====================================================
-- 2. USER ROLES (Assignments)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_user_roles (
  user_role_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,

  -- Role assignment
  role_key          VARCHAR(50) NOT NULL REFERENCES molam_role_definitions(role_key),
  module            VARCHAR(20) NOT NULL,  -- 'pay', 'eats', 'shop', 'talk', 'ads', 'free', 'id', 'global'

  -- Access configuration
  access_scope      VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (access_scope IN ('read', 'write', 'admin', 'owner')),
  trusted_level     INTEGER DEFAULT 0 CHECK (trusted_level >= 0 AND trusted_level <= 5),

  -- Assignment metadata
  assigned_by       UUID NOT NULL REFERENCES molam_users(user_id),
  assigned_at       TIMESTAMPTZ DEFAULT NOW(),
  assigned_reason   TEXT,

  -- Expiration (temporal roles)
  expires_at        TIMESTAMPTZ,

  -- Revocation
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID REFERENCES molam_users(user_id),
  revoked_reason    TEXT,

  -- Status
  is_active         BOOLEAN DEFAULT true,

  -- Approval workflow
  approval_status   VARCHAR(20) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by       UUID REFERENCES molam_users(user_id),
  approved_at       TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT uq_user_role UNIQUE (user_id, module, role_key, revoked_at),
  CONSTRAINT chk_not_revoked CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

CREATE INDEX idx_user_roles_user ON molam_user_roles(user_id) WHERE revoked_at IS NULL AND is_active = true;
CREATE INDEX idx_user_roles_module ON molam_user_roles(module, role_key) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_roles_expires ON molam_user_roles(expires_at) WHERE expires_at IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX idx_user_roles_approval ON molam_user_roles(approval_status, assigned_at) WHERE approval_status = 'pending';

COMMENT ON TABLE molam_user_roles IS 'Role assignments per user and module with temporal and approval support';

-- =====================================================
-- 3. ROLE PERMISSIONS (Fine-grained)
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_role_permissions (
  permission_id     SERIAL PRIMARY KEY,
  role_key          VARCHAR(50) NOT NULL REFERENCES molam_role_definitions(role_key),
  module            VARCHAR(20) NOT NULL,

  -- Permission definition
  resource          VARCHAR(100) NOT NULL,  -- e.g., 'transactions', 'agents', 'wallet'
  action            VARCHAR(50) NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete', 'approve'

  -- Access level
  access_level      VARCHAR(20) NOT NULL DEFAULT 'read' CHECK (access_level IN ('none', 'read', 'write', 'admin')),

  -- Conditions (JSONB for flexibility)
  conditions        JSONB DEFAULT '{}',  -- e.g., {"own_only": true, "max_amount": 10000}

  -- Metadata
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  is_active         BOOLEAN DEFAULT true,

  CONSTRAINT uq_role_permission UNIQUE (role_key, module, resource, action)
);

CREATE INDEX idx_role_perms_role_module ON molam_role_permissions(role_key, module);
CREATE INDEX idx_role_perms_resource ON molam_role_permissions(resource, action);

COMMENT ON TABLE molam_role_permissions IS 'Fine-grained permissions per role, module, and resource';

-- Preload permissions for standard roles

-- Client permissions
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level, conditions) VALUES
  ('client', 'pay', 'wallet', 'read', 'read', '{"own_only": true}'),
  ('client', 'pay', 'transactions', 'create', 'write', '{"own_only": true, "max_amount": 1000000}'),
  ('client', 'pay', 'transactions', 'read', 'read', '{"own_only": true}'),
  ('client', 'eats', 'orders', 'create', 'write', '{"own_only": true}'),
  ('client', 'eats', 'orders', 'read', 'read', '{"own_only": true}'),
  ('client', 'shop', 'orders', 'create', 'write', '{"own_only": true}'),
  ('client', 'shop', 'orders', 'read', 'read', '{"own_only": true}'),
  ('client', 'talk', 'calls', 'create', 'write', '{"own_only": true}'),
  ('client', 'id', 'profile', 'read', 'read', '{"own_only": true}'),
  ('client', 'id', 'profile', 'update', 'write', '{"own_only": true}');

-- Agent permissions
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level, conditions) VALUES
  ('agent', 'pay', 'cashin', 'create', 'write', '{"max_amount": 5000000}'),
  ('agent', 'pay', 'cashout', 'create', 'write', '{"max_amount": 5000000}'),
  ('agent', 'pay', 'commissions', 'read', 'read', '{"own_only": true}'),
  ('agent', 'pay', 'reporting', 'read', 'read', '{"own_only": true}'),
  ('agent', 'pay', 'balance', 'read', 'read', '{"own_only": true}');

-- Merchant permissions
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level, conditions) VALUES
  ('merchant', 'pay', 'payments', 'receive', 'write', '{}'),
  ('merchant', 'pay', 'refunds', 'request', 'write', '{"own_only": true}'),
  ('merchant', 'pay', 'reporting', 'read', 'read', '{"own_only": true}'),
  ('merchant', 'pay', 'settlement', 'read', 'read', '{"own_only": true}'),
  ('merchant', 'eats', 'menu', 'manage', 'admin', '{"own_only": true}'),
  ('merchant', 'eats', 'orders', 'manage', 'admin', '{"own_only": true}'),
  ('merchant', 'shop', 'products', 'manage', 'admin', '{"own_only": true}'),
  ('merchant', 'shop', 'orders', 'manage', 'admin', '{"own_only": true}');

-- Admin permissions (subsidiary admin)
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level) VALUES
  ('admin', 'pay', 'agents', 'manage', 'admin'),
  ('admin', 'pay', 'fees', 'configure', 'admin'),
  ('admin', 'pay', 'limits', 'configure', 'admin'),
  ('admin', 'pay', 'transactions', 'read', 'read'),
  ('admin', 'pay', 'reporting', 'read', 'admin'),
  ('admin', 'eats', 'merchants', 'manage', 'admin'),
  ('admin', 'eats', 'orders', 'manage', 'admin'),
  ('admin', 'shop', 'merchants', 'manage', 'admin'),
  ('admin', 'shop', 'products', 'moderate', 'admin');

-- Auditor permissions (read-only)
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level) VALUES
  ('auditor', 'pay', 'transactions', 'read', 'read'),
  ('auditor', 'pay', 'audit_logs', 'read', 'read'),
  ('auditor', 'pay', 'reporting', 'read', 'read'),
  ('auditor', 'eats', 'transactions', 'read', 'read'),
  ('auditor', 'eats', 'audit_logs', 'read', 'read'),
  ('auditor', 'shop', 'transactions', 'read', 'read'),
  ('auditor', 'shop', 'audit_logs', 'read', 'read');

-- Bank partner permissions
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level) VALUES
  ('bank', 'pay', 'float', 'read', 'read'),
  ('bank', 'pay', 'compliance', 'read', 'read'),
  ('bank', 'pay', 'reconciliation', 'read', 'read'),
  ('bank', 'pay', 'reporting', 'read', 'read');

-- Superadmin permissions (all modules)
INSERT INTO molam_role_permissions (role_key, module, resource, action, access_level)
SELECT 'superadmin', m, r, a, 'admin'
FROM (VALUES ('pay'), ('eats'), ('shop'), ('talk'), ('ads'), ('free'), ('id'), ('global')) AS modules(m)
CROSS JOIN (VALUES ('*')) AS resources(r)
CROSS JOIN (VALUES ('*')) AS actions(a);

-- =====================================================
-- 4. ROLE AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS molam_role_audit (
  audit_id          BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES molam_users(user_id) ON DELETE CASCADE,
  user_role_id      UUID REFERENCES molam_user_roles(user_role_id),

  -- Event
  event_type        VARCHAR(50) NOT NULL,  -- 'role_assigned', 'role_revoked', 'permission_checked', 'access_denied'
  event_timestamp   TIMESTAMPTZ DEFAULT NOW(),

  -- Role details
  role_key          VARCHAR(50),
  module            VARCHAR(20),
  access_scope      VARCHAR(20),
  trusted_level     INTEGER,

  -- Actor
  actor_id          UUID REFERENCES molam_users(user_id),

  -- Context
  ip_address        INET,
  user_agent        TEXT,

  -- Details
  details           JSONB DEFAULT '{}',

  -- Result
  result            VARCHAR(20),  -- 'success', 'denied', 'error'

  -- Immutable
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_role_audit_user ON molam_role_audit(user_id, event_timestamp DESC);
CREATE INDEX idx_role_audit_event ON molam_role_audit(event_type, event_timestamp DESC);
CREATE INDEX idx_role_audit_result ON molam_role_audit(result, event_timestamp DESC) WHERE result = 'denied';

COMMENT ON TABLE molam_role_audit IS 'Immutable audit log for all role-related events';

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Auto-log role assignments
CREATE OR REPLACE FUNCTION log_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO molam_role_audit (user_id, user_role_id, event_type, role_key, module, access_scope, trusted_level, actor_id, result)
    VALUES (NEW.user_id, NEW.user_role_id, 'role_assigned', NEW.role_key, NEW.module, NEW.access_scope, NEW.trusted_level, NEW.assigned_by, 'success');
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL) THEN
    INSERT INTO molam_role_audit (user_id, user_role_id, event_type, role_key, module, actor_id, result, details)
    VALUES (NEW.user_id, NEW.user_role_id, 'role_revoked', NEW.role_key, NEW.module, NEW.revoked_by, 'success', jsonb_build_object('reason', NEW.revoked_reason));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_role_audit
  AFTER INSERT OR UPDATE ON molam_user_roles
  FOR EACH ROW EXECUTE FUNCTION log_role_assignment();

-- Auto-expire temporal roles
CREATE OR REPLACE FUNCTION expire_temporal_roles()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE molam_user_roles
  SET is_active = false
  WHERE expires_at < NOW()
    AND revoked_at IS NULL
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log expiration events
  INSERT INTO molam_role_audit (user_id, user_role_id, event_type, result, details)
  SELECT user_id, user_role_id, 'role_expired', 'success', jsonb_build_object('expired_at', NOW())
  FROM molam_user_roles
  WHERE expires_at < NOW() - INTERVAL '1 minute'
    AND is_active = false
    AND user_role_id NOT IN (
      SELECT user_role_id FROM molam_role_audit WHERE event_type = 'role_expired'
    )
  LIMIT 100;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_temporal_roles IS 'Expire temporal roles (run via cron every 5 minutes)';

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_module VARCHAR,
  p_resource VARCHAR,
  p_action VARCHAR,
  p_context JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  -- Check if user has any active role with this permission
  SELECT EXISTS (
    SELECT 1
    FROM molam_user_roles ur
    JOIN molam_role_permissions rp ON ur.role_key = rp.role_key
    WHERE ur.user_id = p_user_id
      AND ur.module = p_module
      AND ur.revoked_at IS NULL
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND ur.approval_status = 'approved'
      AND rp.module = p_module
      AND (rp.resource = p_resource OR rp.resource = '*')
      AND (rp.action = p_action OR rp.action = '*')
      AND rp.access_level IN ('write', 'admin')
      AND rp.is_active = true
  ) INTO v_has_permission;

  -- Log permission check
  INSERT INTO molam_role_audit (user_id, event_type, module, result, details)
  VALUES (
    p_user_id,
    'permission_checked',
    p_module,
    CASE WHEN v_has_permission THEN 'success' ELSE 'denied' END,
    jsonb_build_object('resource', p_resource, 'action', p_action, 'context', p_context)
  );

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Get user roles
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TABLE(
  user_role_id UUID,
  role_key VARCHAR,
  role_name VARCHAR,
  module VARCHAR,
  access_scope VARCHAR,
  trusted_level INTEGER,
  assigned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ur.user_role_id,
    ur.role_key,
    rd.role_name,
    ur.module,
    ur.access_scope,
    ur.trusted_level,
    ur.assigned_at,
    ur.expires_at
  FROM molam_user_roles ur
  JOIN molam_role_definitions rd ON ur.role_key = rd.role_key
  WHERE ur.user_id = p_user_id
    AND ur.revoked_at IS NULL
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND ur.approval_status = 'approved'
  ORDER BY ur.module, ur.trusted_level DESC;
END;
$$ LANGUAGE plpgsql;

-- Get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_module VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  module VARCHAR,
  resource VARCHAR,
  action VARCHAR,
  access_level VARCHAR,
  conditions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    rp.module,
    rp.resource,
    rp.action,
    rp.access_level,
    rp.conditions
  FROM molam_user_roles ur
  JOIN molam_role_permissions rp ON ur.role_key = rp.role_key AND ur.module = rp.module
  WHERE ur.user_id = p_user_id
    AND ur.revoked_at IS NULL
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND ur.approval_status = 'approved'
    AND rp.is_active = true
    AND (p_module IS NULL OR rp.module = p_module)
  ORDER BY rp.module, rp.resource, rp.action;
END;
$$ LANGUAGE plpgsql;

-- Assign role
CREATE OR REPLACE FUNCTION assign_role(
  p_user_id UUID,
  p_role_key VARCHAR,
  p_module VARCHAR,
  p_access_scope VARCHAR DEFAULT 'read',
  p_trusted_level INTEGER DEFAULT 0,
  p_assigned_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_role_id UUID;
  v_requires_approval BOOLEAN;
BEGIN
  -- Check if role exists and is assignable
  SELECT requires_approval INTO v_requires_approval
  FROM molam_role_definitions
  WHERE role_key = p_role_key AND is_assignable = true AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role_not_assignable' USING HINT = 'Role does not exist or is not assignable';
  END IF;

  -- Check if role already assigned
  IF EXISTS (
    SELECT 1 FROM molam_user_roles
    WHERE user_id = p_user_id
      AND role_key = p_role_key
      AND module = p_module
      AND revoked_at IS NULL
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'role_already_assigned' USING HINT = 'User already has this role for this module';
  END IF;

  -- Insert role assignment
  INSERT INTO molam_user_roles (
    user_id, role_key, module, access_scope, trusted_level,
    assigned_by, assigned_reason, expires_at,
    approval_status
  ) VALUES (
    p_user_id, p_role_key, p_module, p_access_scope, p_trusted_level,
    p_assigned_by, p_reason, p_expires_at,
    CASE WHEN v_requires_approval THEN 'pending' ELSE 'approved' END
  ) RETURNING user_role_id INTO v_user_role_id;

  RETURN v_user_role_id;
END;
$$ LANGUAGE plpgsql;

-- Revoke role
CREATE OR REPLACE FUNCTION revoke_role(
  p_user_role_id UUID,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE molam_user_roles
  SET revoked_at = NOW(),
      revoked_by = p_revoked_by,
      revoked_reason = p_reason,
      is_active = false
  WHERE user_role_id = p_user_role_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get role statistics
CREATE OR REPLACE FUNCTION get_role_statistics(p_module VARCHAR DEFAULT NULL)
RETURNS TABLE(
  role_key VARCHAR,
  role_name VARCHAR,
  module VARCHAR,
  total_assignments INTEGER,
  active_assignments INTEGER,
  pending_approvals INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.role_key,
    rd.role_name,
    ur.module,
    COUNT(*)::INTEGER AS total_assignments,
    COUNT(*) FILTER (WHERE ur.revoked_at IS NULL AND ur.is_active = true)::INTEGER AS active_assignments,
    COUNT(*) FILTER (WHERE ur.approval_status = 'pending')::INTEGER AS pending_approvals
  FROM molam_role_definitions rd
  LEFT JOIN molam_user_roles ur ON rd.role_key = ur.role_key
  WHERE (p_module IS NULL OR ur.module = p_module)
  GROUP BY rd.role_key, rd.role_name, ur.module
  ORDER BY rd.role_key, ur.module;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VIEWS
-- =====================================================

-- Active roles view
CREATE OR REPLACE VIEW v_active_roles AS
SELECT
  ur.user_role_id,
  ur.user_id,
  u.email,
  rd.role_name,
  ur.role_key,
  ur.module,
  ur.access_scope,
  ur.trusted_level,
  ur.assigned_at,
  ur.expires_at,
  ur.assigned_by,
  assigner.email AS assigned_by_email
FROM molam_user_roles ur
JOIN molam_users u ON ur.user_id = u.user_id
JOIN molam_role_definitions rd ON ur.role_key = rd.role_key
LEFT JOIN molam_users assigner ON ur.assigned_by = assigner.user_id
WHERE ur.revoked_at IS NULL
  AND ur.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  AND ur.approval_status = 'approved';

-- Pending approvals view
CREATE OR REPLACE VIEW v_pending_role_approvals AS
SELECT
  ur.user_role_id,
  ur.user_id,
  u.email,
  rd.role_name,
  ur.role_key,
  ur.module,
  ur.access_scope,
  ur.trusted_level,
  ur.assigned_at,
  ur.assigned_by,
  assigner.email AS assigned_by_email,
  ur.assigned_reason
FROM molam_user_roles ur
JOIN molam_users u ON ur.user_id = u.user_id
JOIN molam_role_definitions rd ON ur.role_key = rd.role_key
LEFT JOIN molam_users assigner ON ur.assigned_by = assigner.user_id
WHERE ur.approval_status = 'pending'
  AND ur.revoked_at IS NULL
ORDER BY ur.assigned_at ASC;

-- =====================================================
-- 8. ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE molam_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE molam_role_audit ENABLE ROW LEVEL SECURITY;

-- Users can see their own roles
CREATE POLICY user_roles_select_own ON molam_user_roles
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Users can see their own audit logs
CREATE POLICY role_audit_select_own ON molam_role_audit
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- =====================================================
-- END OF MIGRATION
-- =====================================================
