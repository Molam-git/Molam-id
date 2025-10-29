-- 031_rbac.sql
CREATE TABLE IF NOT EXISTS molam_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('pay', 'eats', 'shop', 'talk', 'ads', 'free', 'id')),
  role TEXT NOT NULL CHECK (role IN ('client','agent','merchant','admin','auditor','bank')),
  access_scope TEXT NOT NULL DEFAULT 'read' CHECK (access_scope IN ('read','write','admin')),
  trusted_level INT DEFAULT 0 CHECK (trusted_level BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES molam_users(id),
  UNIQUE(user_id, module, role)
);

CREATE TABLE IF NOT EXISTS molam_role_groups (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions JSONB NOT NULL,
  UNIQUE(module, role)
);

-- Rôles par défaut
INSERT INTO molam_role_groups (module, role, permissions) VALUES
  ('pay', 'client', '{"transfer": "write", "wallet": "read", "payment": "write"}'),
  ('pay', 'agent', '{"cashin": "write", "cashout": "write", "reporting": "read", "commission": "read"}'),
  ('pay', 'merchant', '{"receive": "write", "refund": "request", "dashboard": "read"}'),
  ('pay', 'admin', '{"agents": "manage", "fees": "set", "transactions": "manage", "reporting": "write"}'),
  ('pay', 'auditor', '{"transactions": "read", "audit_logs": "read", "reports": "read"}'),
  ('pay', 'bank', '{"float": "read", "compliance": "read", "settlements": "read"}'),
  ('eats', 'client', '{"order": "write", "restaurants": "read", "history": "read"}'),
  ('eats', 'merchant', '{"orders": "manage", "menu": "write", "analytics": "read"}'),
  ('eats', 'admin', '{"restaurants": "manage", "drivers": "manage", "fees": "set"}');

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_molam_roles_user_id ON molam_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_molam_roles_module ON molam_roles(module);
CREATE INDEX IF NOT EXISTS idx_molam_roles_trust_level ON molam_roles(trusted_level);