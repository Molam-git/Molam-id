-- 013_blacklist_suspensions.sql

CREATE TYPE suspension_scope AS ENUM ('global','module');

CREATE TABLE IF NOT EXISTS molam_blacklist (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  scope suspension_scope NOT NULL DEFAULT 'global',
  module TEXT,
  reason TEXT NOT NULL,
  issued_by UUID NOT NULL REFERENCES molam_users(id),
  start_at TIMESTAMPTZ DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS molam_blacklist_audit (
  id UUID PRIMARY KEY,
  blacklist_id UUID NOT NULL REFERENCES molam_blacklist(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklist_user ON molam_blacklist(user_id,status);