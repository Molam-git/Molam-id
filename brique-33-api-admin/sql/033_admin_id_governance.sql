-- Catalog of sensitive actions & policies (configurable thresholds)
CREATE TABLE IF NOT EXISTS id_admin_action_policies (
  action_key TEXT PRIMARY KEY,            -- e.g., 'ADD_SUPERADMIN', 'ROTATE_KEYS', 'BREAK_GLASS'
  min_approvals SMALLINT NOT NULL DEFAULT 2,
  expires_in_minutes INTEGER NOT NULL DEFAULT 60, -- elevation request validity
  requires_hsm BOOLEAN NOT NULL DEFAULT FALSE,    -- break-glass, key ops
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requests for sensitive actions (4-eyes workflow)
CREATE TABLE IF NOT EXISTS id_admin_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL REFERENCES id_admin_action_policies(action_key),
  requested_by UUID NOT NULL REFERENCES molam_users(id),
  target_user UUID REFERENCES molam_users(id),
  payload JSONB,                             -- parameters of the action (e.g., role to grant, key-id)
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',    -- PENDING|APPROVED|REJECTED|EXECUTED|EXPIRED|CANCELLED
  approvals_required SMALLINT NOT NULL,
  approvals_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                    -- derived from policy
  idempotency_key TEXT UNIQUE
);

-- Individual approvals (who approved and when)
CREATE TABLE IF NOT EXISTS id_admin_action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES id_admin_action_requests(id) ON DELETE CASCADE,
  approver UUID NOT NULL REFERENCES molam_users(id),
  decision TEXT NOT NULL,                    -- APPROVE|REJECT
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, approver)
);

-- Break-glass registry
CREATE TABLE IF NOT EXISTS id_break_glass_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES id_admin_action_requests(id),
  activated_by UUID NOT NULL REFERENCES molam_users(id),
  hsm_assertion TEXT NOT NULL,               -- attestation from HSM/Vault
  otp_reference TEXT,                        -- out-of-band OTP proof id
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  postmortem_url TEXT,                       -- link to incident post-mortem
  status TEXT NOT NULL DEFAULT 'ACTIVE'      -- ACTIVE|CLOSED
);

-- Immutable audit (append-only). Use DB constraint + storage sink task to S3/WORM.
CREATE TABLE IF NOT EXISTS id_admin_worm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ DEFAULT NOW(),
  actor UUID REFERENCES molam_users(id),
  action_key TEXT NOT NULL,
  object_id UUID,
  request_id UUID REFERENCES id_admin_action_requests(id),
  payload JSONB,
  signature BYTEA,                           -- server-side signature of the log line
  ip INET,
  user_agent TEXT
);

-- Basic policy seeds
INSERT INTO id_admin_action_policies(action_key, min_approvals, expires_in_minutes, requires_hsm)
VALUES
  ('ADD_SUPERADMIN', 2, 120, FALSE),
  ('REMOVE_SUPERADMIN', 2, 120, FALSE),
  ('ELEVATE_TEMP_ROLE', 2, 60, FALSE),
  ('ROTATE_KEYS', 2, 60, TRUE),
  ('BREAK_GLASS', 2, 30, TRUE)
ON CONFLICT (action_key) DO NOTHING;
