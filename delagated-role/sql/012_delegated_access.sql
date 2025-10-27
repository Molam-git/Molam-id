-- 012_delegated_access.sql

CREATE TYPE delegation_status AS ENUM ('pending','active','revoked','expired');

CREATE TABLE IF NOT EXISTS molam_delegations (
  id UUID PRIMARY KEY,
  granter_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  grantee_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  role TEXT NOT NULL,
  country_code CHAR(3) NOT NULL,
  scope JSONB,
  start_at TIMESTAMPTZ DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  status delegation_status DEFAULT 'pending',
  approvers UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delegation_grantee ON molam_delegations(grantee_id, status);

CREATE TABLE IF NOT EXISTS molam_delegation_audit (
  id UUID PRIMARY KEY,
  delegation_id UUID REFERENCES molam_delegations(id) ON DELETE CASCADE,
  action TEXT,
  actor_id UUID,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);