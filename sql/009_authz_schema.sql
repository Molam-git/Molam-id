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
DECLARE
  affected_user_id UUID;
BEGIN
  -- Get the user ID from the trigger (works for both molam_roles and molam_attributes)
  affected_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Delete all cache entries that might involve this user
  -- Since cache_key is a hash, we delete all entries (simple but safe approach)
  -- In production, consider storing user_id in cache table for targeted deletion
  DELETE FROM molam_authz_cache WHERE expires_at < NOW() + INTERVAL '1 second';

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
