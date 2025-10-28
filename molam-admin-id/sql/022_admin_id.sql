CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Tenants / Countries
CREATE TABLE IF NOT EXISTS molam_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  default_currency TEXT NOT NULL,
  timezone TEXT NOT NULL,
  phone_country_code TEXT NOT NULL,
  email_regex TEXT NOT NULL,
  phone_regex TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Modules per tenant (subsidiaries flags)
CREATE TABLE IF NOT EXISTS molam_tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES molam_tenants(id) ON DELETE CASCADE,
  module_scope TEXT NOT NULL CHECK (module_scope IN ('global','pay','eats','talk','ads','shop','free','id')),
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled','maintenance','readonly')),
  maintenance_message TEXT NULL,
  updated_by UUID NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, module_scope)
);

-- 3) Global & per-tenant policies
CREATE TABLE IF NOT EXISTS molam_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL,
  module_scope TEXT NOT NULL CHECK (module_scope IN ('global','pay','eats','talk','ads','shop','free','id')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (COALESCE(tenant_id,'00000000-0000-0000-0000-000000000000'), module_scope, key)
);

-- 4) Emergency locks / Kill-switch
CREATE TABLE IF NOT EXISTS molam_emergency_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','tenant','module','role')),
  tenant_id UUID NULL,
  module_scope TEXT NULL CHECK (module_scope IN ('pay','eats','talk','ads','shop','free','id')),
  role_id UUID NULL,
  reason TEXT NOT NULL,
  ttl_seconds INT NOT NULL DEFAULT 3600,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (created_at + make_interval(secs => ttl_seconds)) STORED
);
CREATE INDEX IF NOT EXISTS idx_emergency_not_expired ON molam_emergency_locks(expires_at);

-- 5) Key registry (reference & audit; material secrets stay in Vault/HSM)
CREATE TABLE IF NOT EXISTS molam_key_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid TEXT UNIQUE NOT NULL,
  alg TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','staging','retiring','retired')),
  rotated_at TIMESTAMPTZ NULL,
  rotated_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) Admin audit (append-only)
CREATE TABLE IF NOT EXISTS molam_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target JSONB NOT NULL,
  diff JSONB NULL,
  ip INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);