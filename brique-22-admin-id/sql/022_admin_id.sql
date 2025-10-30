-- =====================================================================
-- Molam ID — Brique 22: API Admin ID (superadmin global)
-- Migration: 022_admin_id.sql
-- Description: Multi-tenant management, policies, emergency locks,
--              key rotation registry, and admin audit
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Tenants / Countries
-- Each tenant represents a country or region with specific configurations
CREATE TABLE IF NOT EXISTS molam_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                -- ISO 3166-1 alpha-2, e.g., "SN", "CI", "ML"
  name TEXT NOT NULL,                       -- Human-readable name, e.g., "Senegal"
  default_currency TEXT NOT NULL,           -- ISO 4217, e.g., "XOF", "EUR"
  timezone TEXT NOT NULL,                   -- IANA timezone, e.g., "Africa/Dakar"
  phone_country_code TEXT NOT NULL,         -- E.164 prefix, e.g., "+221"
  email_regex TEXT NOT NULL,                -- RFC5322 subset for validation
  phone_regex TEXT NOT NULL,                -- E.164 regex for validation (libphonenumber-compatible)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,       -- Additional configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_code ON molam_tenants(code);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON molam_tenants(is_active);

-- 2) Modules per tenant (subsidiaries status flags)
-- Controls which Molam modules are available in each country
CREATE TABLE IF NOT EXISTS molam_tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES molam_tenants(id) ON DELETE CASCADE,
  module_scope TEXT NOT NULL CHECK (module_scope IN ('pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id')),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled', 'maintenance', 'readonly')),
  maintenance_message TEXT NULL,            -- Message to display during maintenance
  updated_by UUID NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, module_scope)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON molam_tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_status ON molam_tenant_modules(status);

-- 3) Global & per-tenant policies
-- Stores configuration policies that can be global or tenant-specific
CREATE TABLE IF NOT EXISTS molam_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL REFERENCES molam_tenants(id) ON DELETE CASCADE,  -- NULL = global default
  module_scope TEXT NOT NULL CHECK (module_scope IN ('global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id')),
  key TEXT NOT NULL,                        -- e.g., "password.min_length", "kyc.min_level"
  value JSONB NOT NULL,                     -- Flexible JSON value
  description TEXT NULL,                    -- Human-readable description
  updated_by UUID NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (COALESCE(tenant_id::TEXT, '00000000-0000-0000-0000-000000000000'), module_scope, key)
);

CREATE INDEX IF NOT EXISTS idx_policies_tenant ON molam_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_module ON molam_policies(module_scope);
CREATE INDEX IF NOT EXISTS idx_policies_key ON molam_policies(key);

-- 4) Emergency locks / Kill-switch
-- Allows superadmins to temporarily block access at various scopes
CREATE TABLE IF NOT EXISTS molam_emergency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'tenant', 'module', 'role')),
  tenant_id UUID NULL REFERENCES molam_tenants(id) ON DELETE CASCADE,
  module_scope TEXT NULL CHECK (module_scope IN ('pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id')),
  role_id UUID NULL REFERENCES molam_roles_v2(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,                     -- Justification for the lock
  ttl_seconds INT NOT NULL DEFAULT 3600,    -- Time-to-live in seconds
  created_by UUID NOT NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (created_at + make_interval(secs => ttl_seconds)) STORED
);

CREATE INDEX IF NOT EXISTS idx_emergency_locks_expires ON molam_emergency_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_emergency_locks_scope ON molam_emergency_locks(scope);
CREATE INDEX IF NOT EXISTS idx_emergency_locks_tenant ON molam_emergency_locks(tenant_id);

-- Function to check if any lock is active for given context
CREATE OR REPLACE FUNCTION is_locked(
  p_tenant_id UUID,
  p_module_scope TEXT,
  p_role_ids UUID[]
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  lock_count INT;
BEGIN
  SELECT COUNT(*) INTO lock_count
  FROM molam_emergency_locks
  WHERE expires_at > NOW()
    AND (
      scope = 'global'
      OR (scope = 'tenant' AND tenant_id = p_tenant_id)
      OR (scope = 'module' AND tenant_id = p_tenant_id AND module_scope = p_module_scope)
      OR (scope = 'role' AND role_id = ANY(p_role_ids))
    );

  RETURN lock_count > 0;
END $$;

-- 5) Key registry (JWT signing keys metadata)
-- Tracks JWT signing keys for rotation and JWKS publishing
-- Actual key material stays in Vault/HSM
CREATE TABLE IF NOT EXISTS molam_key_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid TEXT UNIQUE NOT NULL,                 -- Key ID published in JWKS
  alg TEXT NOT NULL,                        -- Algorithm, e.g., "RS256", "EdDSA"
  key_type TEXT NOT NULL DEFAULT 'jwt' CHECK (key_type IN ('jwt', 'api', 'encryption')),
  status TEXT NOT NULL CHECK (status IN ('active', 'staging', 'retiring', 'retired')),
  public_key_pem TEXT NULL,                 -- Public key for verification (if applicable)
  metadata JSONB DEFAULT '{}'::jsonb,       -- Additional key metadata
  rotated_at TIMESTAMPTZ NULL,
  rotated_by UUID NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_registry_status ON molam_key_registry(status);
CREATE INDEX IF NOT EXISTS idx_key_registry_kid ON molam_key_registry(kid);

-- 6) Admin audit (append-only immutable log)
-- Tracks all administrative actions
CREATE TABLE IF NOT EXISTS molam_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                     -- e.g., "tenant.create", "module.status.update"
  target JSONB NOT NULL,                    -- What was changed (full record)
  diff JSONB NULL,                          -- Old/new values for updates
  reason TEXT NULL,                         -- Justification if provided
  ip_address INET NULL,
  user_agent TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON molam_admin_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON molam_admin_audit(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON molam_admin_audit(created_at DESC);

-- 7) Admin approvals (for dual-control/four-eyes principle)
-- Optional: require approval from second admin for critical operations
CREATE TABLE IF NOT EXISTS molam_admin_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,                     -- Action type requiring approval
  requested_by UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  request_payload JSONB NOT NULL,           -- Details of the requested action
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID NULL REFERENCES molam_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_approvals_status ON molam_admin_approvals(status);
CREATE INDEX IF NOT EXISTS idx_admin_approvals_requested_by ON molam_admin_approvals(requested_by);

-- 8) Views for convenience

-- Active emergency locks
CREATE OR REPLACE VIEW v_active_locks AS
SELECT
  l.id,
  l.scope,
  l.tenant_id,
  t.code AS tenant_code,
  l.module_scope,
  l.role_id,
  r.name AS role_name,
  l.reason,
  l.created_by,
  u.email AS created_by_email,
  l.created_at,
  l.expires_at,
  EXTRACT(EPOCH FROM (l.expires_at - NOW())) AS remaining_seconds
FROM molam_emergency_locks l
LEFT JOIN molam_tenants t ON t.id = l.tenant_id
LEFT JOIN molam_roles_v2 r ON r.id = l.role_id
LEFT JOIN molam_users u ON u.id = l.created_by
WHERE l.expires_at > NOW()
ORDER BY l.created_at DESC;

-- Tenant modules status overview
CREATE OR REPLACE VIEW v_tenant_modules_overview AS
SELECT
  t.id AS tenant_id,
  t.code AS tenant_code,
  t.name AS tenant_name,
  t.is_active AS tenant_active,
  tm.module_scope,
  tm.status AS module_status,
  tm.maintenance_message,
  tm.updated_at
FROM molam_tenants t
CROSS JOIN (
  SELECT unnest(ARRAY['pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']) AS module_scope
) modules
LEFT JOIN molam_tenant_modules tm ON tm.tenant_id = t.id AND tm.module_scope = modules.module_scope
ORDER BY t.code, modules.module_scope;

-- Active keys for JWKS
CREATE OR REPLACE VIEW v_active_keys AS
SELECT
  kid,
  alg,
  key_type,
  status,
  public_key_pem,
  created_at
FROM molam_key_registry
WHERE status IN ('active', 'staging')
ORDER BY status DESC, created_at DESC;

-- 9) Helper functions

-- Cleanup expired locks (call from cron)
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM molam_emergency_locks WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

-- Get effective policy value (tenant-specific overrides global)
CREATE OR REPLACE FUNCTION get_policy_value(
  p_tenant_id UUID,
  p_module_scope TEXT,
  p_key TEXT
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  policy_value JSONB;
BEGIN
  -- Try tenant-specific first
  SELECT value INTO policy_value
  FROM molam_policies
  WHERE tenant_id = p_tenant_id
    AND module_scope = p_module_scope
    AND key = p_key;

  IF policy_value IS NOT NULL THEN
    RETURN policy_value;
  END IF;

  -- Fall back to global
  SELECT value INTO policy_value
  FROM molam_policies
  WHERE tenant_id IS NULL
    AND module_scope = p_module_scope
    AND key = p_key;

  RETURN policy_value;
END $$;

-- Get tenant's active modules
CREATE OR REPLACE FUNCTION get_tenant_active_modules(p_tenant_id UUID)
RETURNS TABLE(module_scope TEXT, status TEXT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT tm.module_scope, tm.status
  FROM molam_tenant_modules tm
  WHERE tm.tenant_id = p_tenant_id
    AND tm.status = 'enabled';
END $$;

-- 10) Triggers

-- Update updated_at on modifications
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenants_updated ON molam_tenants;
CREATE TRIGGER trg_tenants_updated
  BEFORE UPDATE ON molam_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_modules_updated ON molam_tenant_modules;
CREATE TRIGGER trg_tenant_modules_updated
  BEFORE UPDATE ON molam_tenant_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_policies_updated ON molam_policies;
CREATE TRIGGER trg_policies_updated
  BEFORE UPDATE ON molam_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 11) Comments for documentation
COMMENT ON TABLE molam_tenants IS 'Multi-tenant configuration: countries/regions with localization settings';
COMMENT ON TABLE molam_tenant_modules IS 'Per-tenant module enablement and status (Pay, Eats, Talk, etc.)';
COMMENT ON TABLE molam_policies IS 'Global and tenant-specific configuration policies';
COMMENT ON TABLE molam_emergency_locks IS 'Kill-switch mechanism for emergency access control';
COMMENT ON TABLE molam_key_registry IS 'JWT signing key metadata for rotation and JWKS';
COMMENT ON TABLE molam_admin_audit IS 'Immutable append-only log of all administrative actions';
COMMENT ON TABLE molam_admin_approvals IS 'Dual-control approval workflow for critical admin operations';

COMMENT ON FUNCTION is_locked(UUID, TEXT, UUID[]) IS 'Check if access is blocked by active emergency lock';
COMMENT ON FUNCTION get_policy_value(UUID, TEXT, TEXT) IS 'Get effective policy value with tenant override support';
COMMENT ON FUNCTION cleanup_expired_locks() IS 'Remove expired emergency locks (call from cron)';

-- =====================================================================
-- Migration complete: Brique 22 Admin ID
-- =====================================================================
